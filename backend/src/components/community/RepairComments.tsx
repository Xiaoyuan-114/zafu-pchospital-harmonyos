"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/Button";
import { communityCopy } from "@/config/community";
import { COMMENT_BODY_MAX_LENGTH } from "@/types/contracts";
import type { MemberRef, PaginationMeta, RepairCommentView } from "@/types/contracts";

type Props = { recordId: string };

/** 候选下拉一次最多显示几条（成员名册由 `/api/v1/repair-members` 提供）。 */
const MENTION_MENU_LIMIT = 8;

type MentionQuery = { start: number; text: string };

/**
 * 光标处是否正处在一个 `@名字` 片段里。
 *
 * 只在「@ 前面是行首或空白、且 @ 之后到光标之间没有空白」时算数 ——
 * 否则 `name@example.com` 这类文本会误触候选。
 */
function mentionQueryAt(value: string, caret: number | null): MentionQuery | null {
  if (caret === null) return null;
  const before = value.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at < 0) return null;
  const text = before.slice(at + 1);
  if (/\s/.test(text)) return null;
  const prev = at === 0 ? "" : before[at - 1];
  if (prev && !/\s/.test(prev)) return null;
  return { start: at, text };
}

/** 把正文里被提及的 `@姓名` 高亮。名字以服务端解析结果为准，最长名优先（与服务端一致）。 */
function renderCommentBody(body: string, mentions: MemberRef[]): ReactNode {
  if (mentions.length === 0) return body;
  const names = mentions
    .map((mention) => mention.name)
    .sort((a, b) => b.length - a.length)
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of body.matchAll(new RegExp(`@(${names.join("|")})`, "g"))) {
    const index = match.index ?? 0;
    if (index > last) parts.push(body.slice(last, index));
    parts.push(
      <span className="community-mention" key={`${index}-${match[1]}`}>
        {match[0]}
      </span>,
    );
    last = index + match[0].length;
  }
  if (last >= body.length) return parts;
  parts.push(body.slice(last));
  return parts;
}

export function RepairComments({ recordId }: Props) {
  const copy = communityCopy.comments;
  const [items, setItems] = useState<RepairCommentView[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>();
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<RepairCommentView | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 成员名册只取一次；null 表示还没拿到（拿不到时不显示空态，免得误报「没有匹配」）。 */
  const [candidates, setCandidates] = useState<MemberRef[] | null>(null);
  const [mention, setMention] = useState<MentionQuery | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const candidatesRequested = useRef(false);

  const matches =
    mention === null
      ? []
      : (candidates ?? [])
          .filter(
            (member) =>
              mention.text === "" ||
              member.name.toLowerCase().includes(mention.text.toLowerCase()),
          )
          .slice(0, MENTION_MENU_LIMIT);
  const mentionText = mention?.text ?? null;

  useEffect(() => {
    setActiveIndex(0);
  }, [mentionText]);

  /** 回到上一次插入之后的光标位置：改完 draft 才能设，所以放在 layout effect 里。 */
  useLayoutEffect(() => {
    const caret = pendingCaret.current;
    if (caret === null) return;
    pendingCaret.current = null;
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(caret, caret);
  }, [draft]);

  const ensureCandidates = useCallback(async () => {
    if (candidatesRequested.current) return;
    candidatesRequested.current = true;
    try {
      const response = await fetch("/api/v1/repair-members", { cache: "no-store" });
      const json = await response.json();
      if (!json.success) throw new Error();
      setCandidates(json.data as MemberRef[]);
    } catch {
      // 失败允许下次输入时重试，不把「名册加载失败」当成「没有匹配的成员」。
      candidatesRequested.current = false;
    }
  }, []);

  const syncMention = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const next = mentionQueryAt(textarea.value, textarea.selectionStart);
    setMention((current) =>
      current && next && current.start === next.start && current.text === next.text
        ? current
        : next,
    );
    if (next) void ensureCandidates();
  }, [ensureCandidates]);

  function acceptMention(member: MemberRef) {
    if (mention === null) return;
    const caret = textareaRef.current?.selectionStart ?? draft.length;
    const rest = draft.slice(caret);
    // 后面已经是空格就不再多插一个；否则补一个，保证服务端的「@ + 空白」切词能认出来。
    const suffix = rest.startsWith(" ") ? "" : " ";
    setDraft(`${draft.slice(0, mention.start)}@${member.name}${suffix}${rest}`);
    pendingCaret.current = mention.start + member.name.length + 1 + suffix.length;
    setMention(null);
  }

  function startReply(target: RepairCommentView) {
    setReplyTo(target);
    const next = `@${target.author.name} `;
    setDraft(next);
    pendingCaret.current = next.length;
  }

  function onComposerKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (mention === null) return;
    if (event.key === "Escape") {
      setMention(null);
      return;
    }
    if (matches.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % matches.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + matches.length) % matches.length);
      return;
    }
    if (event.key === "Tab" || (event.key === "Enter" && !event.shiftKey)) {
      // 菜单开着时 Enter 先用来选人；正文换行仍走 Shift+Enter。
      event.preventDefault();
      acceptMention(matches[activeIndex] ?? matches[0]);
    }
  }

  const load = useCallback(
    async (mode: "full" | "silent" = "full") => {
      if (mode === "full") setState("loading");
      try {
        const response = await fetch(`/api/v1/repairs/${recordId}/comments?page=1&pageSize=50`, {
          cache: "no-store",
        });
        const json = await response.json();
        if (!json.success) throw new Error();
        setItems(json.data as RepairCommentView[]);
        setPagination(json.meta.pagination as PaginationMeta);
        setState("ready");
      } catch {
        setState("error");
      }
    },
    [recordId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/repairs/${recordId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: draft,
          parentCommentId: replyTo?.id ?? null,
        }),
      });
      const json = await response.json();
      if (!json.success) {
        setError(json.error?.message ?? copy.loadError);
        return;
      }
      setDraft("");
      setReplyTo(null);
      setMention(null);
      await load("silent");
    } catch {
      setError(copy.loadError);
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(comment: RepairCommentView) {
    setError(null);
    try {
      const response = await fetch(`/api/v1/repairs/${recordId}/comments/${comment.id}`, {
        method: "DELETE",
      });
      const json = await response.json();
      if (!json.success) {
        setError(json.error?.message ?? copy.loadError);
        return;
      }
      await load("silent");
    } catch {
      setError(copy.loadError);
    }
  }

  if (state === "loading") return <p role="status">{copy.loading}</p>;
  if (state === "error") {
    return (
      <div className="community-block">
        <p>{copy.loadError}</p>
        <Button onClick={() => void load()}>{copy.reload}</Button>
      </div>
    );
  }

  return (
    <div className="community-block">
      <header className="community-block__head">
        <h2 className="text-display-3 font-bold">{copy.title}</h2>
        <span className="member-section__tag">{copy.tag}</span>
      </header>
      {pagination ? (
        <p className="community-block__meta">{copy.rootCount.replace("{count}", String(pagination.total))}</p>
      ) : null}
      {items.length === 0 ? <p className="member-section__note">{copy.empty}</p> : null}
      <ul className="community-thread">
        {items.map((comment) => (
          <li className="community-comment" key={comment.id}>
            <CommentItem
              comment={comment}
              onReply={() => startReply(comment)}
              onDelete={() => void remove(comment)}
            />
            {comment.replies.length > 0 ? (
              <ul className="community-thread community-thread--replies">
                {comment.replies.map((reply) => (
                  <li className="community-comment" key={reply.id}>
                    <CommentItem
                      comment={reply}
                      onReply={() => startReply(reply)}
                      onDelete={() => void remove(reply)}
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
      <form
        className="community-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {replyTo ? (
          <p className="community-composer__reply">
            {copy.replyTo.replace("{name}", replyTo.author.name)}
            <Button type="button" variant="ghost" onClick={() => setReplyTo(null)}>
              {copy.cancelReply}
            </Button>
          </p>
        ) : null}
        <div className="community-composer__field">
          <label className="field">
            <span className="sr-only">{replyTo ? copy.replyPlaceholder : copy.placeholder}</span>
            <textarea
              ref={textareaRef}
              className="field__input community-composer__input"
              value={draft}
              maxLength={COMMENT_BODY_MAX_LENGTH}
              rows={4}
              placeholder={replyTo ? copy.replyPlaceholder : copy.placeholder}
              onChange={(event) => {
                setDraft(event.target.value);
                syncMention();
              }}
              onClick={syncMention}
              onKeyUp={syncMention}
              onKeyDown={onComposerKeyDown}
              onBlur={() => setMention(null)}
            />
          </label>
          {/* 候选是绝对定位的浮层：出现与消失都不影响下方按钮的位置。 */}
          {mention !== null && matches.length > 0 ? (
            <ul className="mention-menu" role="listbox" aria-label={copy.mentionMenuLabel}>
              {matches.map((member, index) => (
                <li key={member.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    className={
                      index === activeIndex
                        ? "mention-menu__item mention-menu__item--active"
                        : "mention-menu__item"
                    }
                    onMouseEnter={() => setActiveIndex(index)}
                    // mousedown 就选中并阻止默认：否则先 blur 关掉菜单，点击落空。
                    onMouseDown={(event) => {
                      event.preventDefault();
                      acceptMention(member);
                    }}
                  >
                    {member.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {mention !== null && matches.length === 0 && candidates !== null ? (
            <p className="mention-menu mention-menu--empty">{copy.mentionEmpty}</p>
          ) : null}
        </div>
        <p className="community-composer__hint">{copy.mentionHint}</p>
        {error ? <p className="community-composer__error">{error}</p> : null}
        <Button type="submit" variant="solid" disabled={submitting || !draft.trim()}>
          {submitting ? copy.submitting : copy.submit}
        </Button>
      </form>
    </div>
  );
}

function CommentItem({
  comment,
  onReply,
  onDelete,
}: {
  comment: RepairCommentView;
  onReply: () => void;
  onDelete: () => void;
}) {
  const copy = communityCopy.comments;
  return (
    <article className="community-comment__body">
      <header className="community-comment__meta">
        <strong>{comment.author.name}</strong>
        <time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString("zh-CN")}</time>
      </header>
      <p className="community-comment__text">{renderCommentBody(comment.body, comment.mentions)}</p>
      <div className="community-comment__actions">
        <Button type="button" variant="ghost" onClick={onReply}>
          {copy.reply}
        </Button>
        {comment.canDelete ? (
          <Button type="button" variant="ghost" onClick={onDelete}>
            {copy.delete}
          </Button>
        ) : null}
      </div>
    </article>
  );
}
