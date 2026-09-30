"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { memberCopy } from "@/config/member";
import { TagPicker } from "@/components/ui/TagPicker";
import { mergeSkillOptions } from "@/features/skills/skill-options";
import {
  MEMBER_NICKNAME_MAX_LENGTH,
  MEMBER_SKILL_LIMIT,
  SKILL_NAME_MAX_LENGTH,
  type MemberSelfProfile,
  type SkillView,
} from "@/types/contracts";

/**
 * MemberProfileEditor —— 昵称 + 技能标签编辑
 *
 * 两个字段走两个接口，乐观锁版本号各不相同：
 * - `PATCH /member/profile` 用 `profile.version` 更新昵称；
 * - `PUT /member/profile/skills` 用 `profileVersion` 更新技能关联。
 *
 * 关键点：
 * 1. 每次成功保存都必须用响应里的新 `version` 覆盖本地值，否则第二次保存必然 409。
 * 2. 409（版本冲突）与普通失败要给**不同**提示：冲突时引导刷新，而不是让用户重试。
 * 3. 昵称前端只做「长度 + 空白」这样的廉价校验，真实规则以服务端为准；
 *    服务端的 `fieldErrors` 一律原样展示。
 */

export type MemberProfileEditorProps = {
  profile: MemberSelfProfile;
  /** 服务端已确认的启用技能列表 */
  availableSkills: SkillView[];
  /** 保存成功后把最新资料回传给父级，保持只读视图同步 */
  onProfileChange: (profile: MemberSelfProfile) => void;
};

type Status = { kind: "idle" | "saving" | "saved" | "error" | "conflict"; message?: string };

export function MemberProfileEditor({
  profile,
  availableSkills,
  onProfileChange,
}: MemberProfileEditorProps) {
  const copy = memberCopy.profile;
  const [nickname, setNickname] = useState(profile.nickname ?? "");
  const [version, setVersion] = useState(profile.version);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>(() =>
    profile.skills.map((skill) => skill.id),
  );
  const [skillVersion, setSkillVersion] = useState(profile.version);
  /**
   * 成员本轮新建的标签（issue #68）。它们已经是库里的真实行，只是父级传入的
   * `availableSkills` 是服务端渲染时的那一份、不会自己变，所以本地补进来。
   */
  const [createdSkills, setCreatedSkills] = useState<SkillView[]>([]);
  const [newSkillName, setNewSkillName] = useState("");
  const skillOptions = useMemo(
    () => mergeSkillOptions([...availableSkills, ...createdSkills], profile.skills),
    [availableSkills, createdSkills, profile.skills],
  );

  // 父级刷新资料后同步本地草稿（例如用户点了「取消」重新载入）
  useEffect(() => {
    setNickname(profile.nickname ?? "");
    setVersion(profile.version);
    setSelectedSkillIds(profile.skills.map((skill) => skill.id));
    setSkillVersion(profile.version);
  }, [profile]);

  const [nicknameStatus, setNicknameStatus] = useState<Status>({ kind: "idle" });
  const [skillsStatus, setSkillsStatus] = useState<Status>({ kind: "idle" });
  /** 新建标签的独立状态；技能区只渲染一条状态行（见下方渲染处），避免区块高度来回变。 */
  const [createStatus, setCreateStatus] = useState<Status>({ kind: "idle" });

  const nicknameDirty = nickname !== (profile.nickname ?? "");
  const skillsDirty = useMemo(() => {
    const current = [...profile.skills.map((skill) => skill.id)].sort();
    const next = [...selectedSkillIds].sort();
    return current.length !== next.length || current.some((id, index) => id !== next[index]);
  }, [profile.skills, selectedSkillIds]);

  const saveNickname = useCallback(async () => {
    const trimmed = nickname.trim();
    if (trimmed.length > MEMBER_NICKNAME_MAX_LENGTH) {
      setNicknameStatus({ kind: "error", message: copy.invalidNickname });
      return;
    }

    setNicknameStatus({ kind: "saving" });
    try {
      const response = await fetch("/api/v1/member/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ nickname: trimmed === "" ? null : trimmed, version }),
      });
      const json = await response.json();

      if (!json.success) {
        setNicknameStatus(describeFailure(json, copy.conflict, copy.saveFailed));
        return;
      }

      const next = json.data.profile as MemberSelfProfile;
      setVersion(json.data.version);
      setSkillVersion(json.data.version);
      onProfileChange(next);
      setNicknameStatus({ kind: "saved", message: copy.saved });
    } catch {
      setNicknameStatus({ kind: "error", message: copy.saveFailed });
    }
  }, [
    copy.conflict,
    copy.invalidNickname,
    copy.saveFailed,
    copy.saved,
    nickname,
    onProfileChange,
    version,
  ]);

  const saveSkills = useCallback(async () => {
    if (selectedSkillIds.length > MEMBER_SKILL_LIMIT) {
      setSkillsStatus({
        kind: "error",
        message: copy.skillsLimitReached.replace("{limit}", String(MEMBER_SKILL_LIMIT)),
      });
      return;
    }

    setCreateStatus({ kind: "idle" });
    setSkillsStatus({ kind: "saving" });
    try {
      const response = await fetch("/api/v1/member/profile/skills", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ skillIds: selectedSkillIds, profileVersion: skillVersion }),
      });
      const json = await response.json();

      if (!json.success) {
        setSkillsStatus(describeFailure(json, copy.conflict, copy.saveFailed));
        return;
      }

      setSkillVersion(json.data.version);
      setVersion(json.data.version);
      // 保存接口返回的是技能视图，不是完整资料；这里把它并入资料后回传父级。
      onProfileChange({
        ...profile,
        skills: json.data.skills as SkillView[],
        version: json.data.version,
      });
      setSkillsStatus({ kind: "saved", message: copy.skillsSaved });
    } catch {
      setSkillsStatus({ kind: "error", message: copy.saveFailed });
    }
  }, [
    copy.conflict,
    copy.saveFailed,
    copy.skillsLimitReached,
    copy.skillsSaved,
    onProfileChange,
    profile,
    selectedSkillIds,
    skillVersion,
  ]);

  /**
   * 新建一个标签库里没有的标签，并顺手选中它（issue #68：成员自建，无需审核）。
   *
   * 同名标签由服务端复用（返回已有行），因此这里不需要「这个名字是不是已经有了」的预检；
   * 新建只写标签库，**不**自动保存关联 —— 关联仍然由「保存」按钮走带乐观锁的 PUT，
   * 两个动作不合并，避免一次点击里连做两次带版本号的写。
   */
  const createSkill = useCallback(async () => {
    setCreateStatus({ kind: "saving" });
    try {
      const response = await fetch("/api/v1/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ name: newSkillName.trim() }),
      });
      const json = await response.json();

      if (!json.success) {
        setCreateStatus(describeFailure(json, copy.conflict, copy.skillCreateFailed));
        return;
      }

      const created = json.data as SkillView;
      setCreatedSkills((current) =>
        current.some((skill) => skill.id === created.id) ? current : [...current, created],
      );
      setNewSkillName("");
      // 已达上限时不自动选中：选择器自己的「已达上限」提示已经说明了原因。
      setSelectedSkillIds((current) =>
        current.includes(created.id) || current.length >= MEMBER_SKILL_LIMIT
          ? current
          : [...current, created.id],
      );
      setSkillsStatus({ kind: "idle" });
      setCreateStatus({
        kind: "saved",
        message: copy.skillCreated.replace("{name}", created.name),
      });
    } catch {
      setCreateStatus({ kind: "error", message: copy.skillCreateFailed });
    }
  }, [copy.conflict, copy.skillCreateFailed, copy.skillCreated, newSkillName]);

  const nicknameHint = copy.nicknameHint.replace("{max}", String(MEMBER_NICKNAME_MAX_LENGTH));
  const skillsLead = copy.skillsLead.replace("{limit}", String(MEMBER_SKILL_LIMIT));
  /** 保存关联或新建标签期间，技能区的选择器/输入行一起禁用——两件事写的是同一批数据。 */
  const skillsBusy = skillsStatus.kind === "saving" || createStatus.kind === "saving";

  return (
    <>
      <div className="member-section">
        <header className="member-section__head">
          <h2 className="member-section__title" id="member-nickname-title">
            {copy.nicknameLabel}
          </h2>
          <span className="member-section__tag">Nickname</span>
        </header>
        <form
          className="member-form"
          aria-labelledby="member-nickname-title"
          onSubmit={(event) => {
            event.preventDefault();
            void saveNickname();
          }}
        >
          <label className="field">
            <span className="field__label">{copy.nicknameLabel}</span>
            <input
              className="field__input"
              value={nickname}
              maxLength={MEMBER_NICKNAME_MAX_LENGTH}
              placeholder={copy.nicknamePlaceholder}
              onChange={(event) => {
                setNickname(event.target.value);
                setNicknameStatus({ kind: "idle" });
              }}
            />
            <span className="member-section__note">{nicknameHint}</span>
          </label>
          <div className="member-form__actions">
            <Button
              type="submit"
              variant="solid"
              disabled={nicknameStatus.kind === "saving" || !nicknameDirty}
            >
              {nicknameStatus.kind === "saving" ? memberCopy.common.saving : memberCopy.common.save}
            </Button>
            {nicknameDirty ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setNickname(profile.nickname ?? "");
                  setNicknameStatus({ kind: "idle" });
                }}
              >
                {memberCopy.common.cancel}
              </Button>
            ) : null}
          </div>
          <StatusLine status={nicknameStatus} />
        </form>
      </div>

      <div className="member-section">
        <header className="member-section__head">
          <h2 className="member-section__title" id="member-skills-editor-title">
            {copy.skillsTitle}
          </h2>
          <span className="member-section__tag">{copy.skillsTag}</span>
        </header>
        <p className="member-section__note">{skillsLead}</p>
        <TagPicker
          options={skillOptions}
          selectedIds={selectedSkillIds}
          limit={MEMBER_SKILL_LIMIT}
          disabled={skillsBusy}
          labels={{
            empty: copy.skillsEmpty,
            remaining: copy.skillsRemaining,
            remove: copy.skillsRemove,
            inactive: copy.skillInactiveSelected,
            limitReached: copy.skillsLimitReached,
          }}
          onChange={(next) => {
            setSelectedSkillIds(next);
            setSkillsStatus({ kind: "idle" });
          }}
        />

        {/* 标签库没有的名称可以自己新建（issue #68，无需审核）：输入行常驻，
            不存在「点一下多出一行」的位移。 */}
        <form
          className="member-form"
          onSubmit={(event) => {
            event.preventDefault();
            void createSkill();
          }}
        >
          <label className="field">
            <span className="field__label">{copy.skillCreateLabel}</span>
            <input
              className="field__input"
              value={newSkillName}
              maxLength={SKILL_NAME_MAX_LENGTH}
              placeholder={copy.skillCreatePlaceholder}
              disabled={skillsBusy}
              onChange={(event) => {
                setNewSkillName(event.target.value);
                setCreateStatus({ kind: "idle" });
              }}
            />
            <span className="member-section__note">{copy.skillCreateHint}</span>
          </label>
          <div className="member-form__actions">
            <Button
              type="submit"
              variant="ghost"
              disabled={skillsBusy || newSkillName.trim() === ""}
            >
              {createStatus.kind === "saving" ? copy.skillCreateBusy : copy.skillCreateAction}
            </Button>
          </div>
        </form>

        <div className="member-form__actions">
          <Button
            variant="solid"
            disabled={skillsBusy || !skillsDirty}
            onClick={() => void saveSkills()}
          >
            {skillsStatus.kind === "saving" ? memberCopy.common.saving : memberCopy.common.save}
          </Button>
          {skillsDirty ? (
            <Button
              variant="ghost"
              onClick={() => {
                setSelectedSkillIds(profile.skills.map((skill) => skill.id));
                setSkillsStatus({ kind: "idle" });
              }}
            >
              {memberCopy.common.cancel}
            </Button>
          ) : null}
        </div>
        {/* 技能区共用一条状态行：新建与保存的结果不会同时有效，各占一行会让区块高度来回变。 */}
        <StatusLine status={createStatus.kind === "idle" ? skillsStatus : createStatus} />
      </div>
    </>
  );
}

/** 把失败响应翻译成展示状态：版本冲突单列，其余按普通失败处理。 */
function describeFailure(
  json: { error?: { code?: string; message?: string; fieldErrors?: unknown } },
  conflictLabel: string,
  fallbackLabel: string,
): Status {
  // 服务端乐观锁冲突的唯一错误码，见 `src/lib/api/errors.ts`。
  if (json.error?.code === "MEMBER_PROFILE_VERSION_CONFLICT") {
    return { kind: "conflict", message: conflictLabel };
  }
  // 服务端逐字段错误优先（例如昵称含控制字符），否则用服务端 message，最后才兜底。
  const fieldErrors = json.error?.fieldErrors as Record<string, string[]> | undefined;
  const firstField = fieldErrors ? Object.values(fieldErrors)[0]?.[0] : undefined;
  return { kind: "error", message: firstField ?? json.error?.message ?? fallbackLabel };
}

function StatusLine({ status }: { status: Status }) {
  if (status.kind === "idle" || !status.message) return null;
  return (
    <p
      className={`member-form__status${status.kind === "error" || status.kind === "conflict" ? "member-form__status--error" : ""}`}
      role={status.kind === "error" || status.kind === "conflict" ? "alert" : "status"}
      aria-live="polite"
    >
      {status.message}
    </p>
  );
}
