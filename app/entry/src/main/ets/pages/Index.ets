import { ROUTE_KNOWLEDGE, ROUTE_REPAIR, ROUTE_SERVICE } from '../core/ui/Routes';
import { PAGE_PADDING, CARD_RADIUS } from '../core/ui/Theme';
import { ServicePage } from '../features/service/ServicePage';
import { RepairPage } from '../features/repair/RepairPage';
import { KnowledgePage } from '../features/knowledge/KnowledgePage';

@Entry
@Component
struct Index {
  @State private pathStack: NavPathStack = new NavPathStack();

  @Builder
  destination(name: string) {
    if (name === ROUTE_SERVICE) {
      ServicePage();
    } else if (name === ROUTE_REPAIR) {
      RepairPage();
    } else if (name === ROUTE_KNOWLEDGE) {
      KnowledgePage();
    }
  }

  @Builder
  entryCard(title: string, note: string, route: string) {
    Column({ space: 6 }) {
      Text(title).fontSize(20).fontWeight(FontWeight.Medium).fontColor($r('app.color.text_primary'))
      Text(note).fontSize(14).fontColor($r('app.color.text_secondary'))
    }
    .width('100%').padding(18).alignItems(HorizontalAlign.Start)
    .backgroundColor($r('app.color.surface')).borderRadius(CARD_RADIUS)
    .onClick(() => this.pathStack.pushPathByName(route, null))
  }

  build() {
    Navigation(this.pathStack) {
      Column({ space: 16 }) {
        Text('鸿蒙电脑医院').fontSize(30).fontWeight(FontWeight.Bold)
          .fontColor($r('app.color.text_primary'))
        Text('课程实验 · 原生应用骨架').fontSize(15).fontColor($r('app.color.text_secondary'))
        this.entryCard('客户服务', '报修与预约入口 · 待接入', ROUTE_SERVICE)
        this.entryCard('工作人员', '受理与维修备案 · 待接入', ROUTE_REPAIR)
        this.entryCard('知识问答', '有出处的 AI 咨询 · 待接入', ROUTE_KNOWLEDGE)
      }
      .width('100%').height('100%').padding(PAGE_PADDING)
      .alignItems(HorizontalAlign.Start)
      .backgroundColor($r('app.color.start_window_background'))
    }
    .title('电脑医院').navDestination(this.destination)
  }
}
