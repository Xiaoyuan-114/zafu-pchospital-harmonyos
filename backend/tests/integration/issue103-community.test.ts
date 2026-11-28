import { GET as listCircles } from "../../src/app/api/v1/forum/circles/route";
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { getDb, disconnectDb } from '../../src/lib/db/client';
import { inSerializableTransaction } from '../../src/lib/db/transaction';
import { communityPoints, reconcileActivityPoints } from '../../src/features/forum/community-points';
import { communityService } from '../../src/features/forum/community-service';
import { forumService } from '../../src/features/forum/forum-service';
import { integrationTestsEnabled } from './db-guard';
import type { AuthorizedActor } from '../../src/types/contracts';
const dbTest = integrationTestsEnabled() ? test : test.skip;
const a = randomUUID(), b = randomUUID(), activityId = randomUUID();
const actor = (userId:string, admin=false):AuthorizedActor => ({requestId:'issue103-test',actorType:'USER',userId,userStatus:'ACTIVE',permissions:admin ? ['forum.circle:manage'] : []});
let circleId = '';
before(async () => { if (!integrationTestsEnabled()) return; const now=new Date(); for (const id of [a,b]) await getDb().user.create({data:{id,status:'ACTIVE',displayName:'课设测试',createdAt:now,updatedAt:now}}); });
after(async () => { if (!integrationTestsEnabled()) return; const db=getDb(); await db.communityPointEntry.deleteMany({where:{userId:{in:[a,b]}}}); await db.communityDailyCheckIn.deleteMany({where:{userId:{in:[a,b]}}}); await db.communityActivityReward.deleteMany({where:{userId:{in:[a,b]}}}); await db.repairActivityRegistration.deleteMany({where:{activityId}}); await db.repairActivity.deleteMany({where:{id:activityId}}); await db.forumPost.deleteMany({where:{authorId:{in:[a,b]}}}); await db.forumCircleMembership.deleteMany({where:{userId:{in:[a,b]}}}); await db.forumFollow.deleteMany({where:{userId:{in:[a,b]}}}); await db.forumCircle.deleteMany({where:{createdBy:a}}); await db.user.deleteMany({where:{id:{in:[a,b]}}}); await disconnectDb(); });
dbTest('关注、圈子权限与合并频道去重',async()=>{
 const c=await communityService.saveCircle(null,{name:'测试圈',description:'测试',category:'电脑',createRequestKey:randomUUID()},actor(a,true)); circleId=c.id;
 await assert.rejects(communityService.join(circleId,true,actor(a)).then(async()=>{ await communityService.saveCircle(null,{name:'无权',description:'测试',category:'电脑',createRequestKey:randomUUID()},actor(b)); }));
 await assert.rejects(forumService.create({category:'GENERAL',title:'禁止',body:'正文',circleId,createRequestKey:randomUUID()},actor(b)));
 await communityService.join(circleId,true,actor(b)); await communityService.follow(a,true,actor(b));
 const post=await forumService.create({category:'GENERAL',title:'测试帖子',body:'正文',circleId,createRequestKey:randomUUID()},actor(a));
 const list=await forumService.listPublic({channel:'following'}, {page:1,pageSize:20}, actor(b)); assert.equal(list.items.filter(x=>x.id===post.id).length,1);
 const hot=await forumService.listPublic({circleId,sort:'hot'},{page:1,pageSize:20},null); assert.ok(hot.items.some(x=>x.id===post.id));
 await communityService.join(circleId,false,actor(b)); await communityService.follow(a,false,actor(b));
 assert.equal((await forumService.listPublic({channel:'following'},{page:1,pageSize:20},actor(b))).items.length,0);
});
dbTest('上海日历日打卡重试、跨日和中断',async()=>{
 const t=new Date('2026-11-26T16:00:00Z');
 await Promise.all([communityPoints.checkIn(actor(b),t),communityPoints.checkIn(actor(b),t)]);
 assert.equal((await communityPoints.status(actor(b),t)).points,1);
 await communityPoints.checkIn(actor(b),new Date('2026-11-27T16:00:00Z'));
 assert.equal((await communityPoints.status(actor(b),new Date('2026-11-27T16:00:00Z'))).streak,2);
 assert.equal((await communityPoints.status(actor(b),new Date('2026-11-29T16:00:00Z'))).streak,0);
});
dbTest('同账号多条报名，撤回与恢复只记录一次现场积分',async()=>{
 const db=getDb(), now=new Date(); await db.repairActivity.create({data:{id:activityId,title:'测试活动',activityAt:now,signupOpensAt:now,signupClosesAt:now,capacity:10,createdAt:now}});
 const ids=[randomUUID(),randomUUID()]; for(const [i,id] of ids.entries()) await db.repairActivityRegistration.create({data:{id,activityId,userId:b,name:'测试',phone:'1000000000'+i,phoneLast4:'000'+i,issueType:'OTHER',status:'CHECKED_IN',pointsEligible:true,createdAt:now}});
 const sync=()=>inSerializableTransaction(async tx=>{await tx.$queryRaw`SELECT id FROM repair_activities WHERE id = ${activityId} FOR UPDATE`;await reconcileActivityPoints(tx,activityId,[b]);});
 await sync(); await sync(); assert.equal((await db.communityPointEntry.aggregate({where:{userId:b,source:'ACTIVITY'},_sum:{amount:true}}))._sum.amount,10);
 await db.repairActivityRegistration.update({where:{id:ids[0]},data:{status:'REGISTERED'}}); await sync();
 await db.repairActivityRegistration.update({where:{id:ids[1]},data:{status:'REGISTERED'}}); await sync();
 assert.equal((await db.communityPointEntry.aggregate({where:{userId:b,source:'ACTIVITY'},_sum:{amount:true}}))._sum.amount,0);
 await db.repairActivityRegistration.update({where:{id:ids[0]},data:{status:'CHECKED_IN'}}); await sync();
 assert.equal((await db.communityPointEntry.aggregate({where:{userId:b,source:'ACTIVITY'},_sum:{amount:true}}))._sum.amount,10);
});

dbTest("圈子分类独立于首页，按分类筛选后再分页", async () => {
  const hiddenCategory = "分类-" + randomUUID();
  const save = (category: string) => communityService.saveCircle(null, {
    name: "测试圈", description: "测试", category, createRequestKey: randomUUID(),
  }, actor(a, true));
  await save("分类-其他");
  const target = await save(hiddenCategory);
  for (const query of ["pageSize=1", "view=categories", "category=" + encodeURIComponent(hiddenCategory) + "&pageSize=1"]) {
    const response = await listCircles(new Request("http://localhost/api/v1/forum/circles?" + query));
    assert.equal(response.status, 200);
    const { data, meta } = await response.json();
    if (query === "pageSize=1") assert.ok(!data.some((item: { id: string }) => item.id === target.id));
    else if (query === "view=categories") assert.ok(data.includes(hiddenCategory));
    else {
      assert.deepEqual(data.map((item: { id: string }) => item.id), [target.id]);
      assert.equal(meta.pagination.total, 1);
    }
  }
});
