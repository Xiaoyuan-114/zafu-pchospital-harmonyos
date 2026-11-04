/** 公开论坛 App 契约；作者身份与操作权限均由服务端响应决定。 */
export const FORUM_CATEGORY_GENERAL: string = 'GENERAL';
export const FORUM_CATEGORY_EXPERIENCE: string = 'EXPERIENCE';
export const FORUM_CATEGORY_QUESTION: string = 'QUESTION';

export interface ForumAuthorView {
  id: string;
  displayName: string;
}

export interface ForumImageView {
  id: string;
  url: string;
  sortOrder: number;
}

export interface ForumPostActions {
  canDelete: boolean;
  canUploadImages: boolean;
  canComment: boolean;
}

export interface ForumPostView {
  id: string;
  category: string;
  title: string;
  body: string;
  author: ForumAuthorView;
  images: ForumImageView[];
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  actions: ForumPostActions;
}

export interface ForumCommentActions {
  canDelete: boolean;
}

export interface ForumCommentView {
  id: string;
  postId: string;
  body: string;
  author: ForumAuthorView;
  createdAt: string;
  actions: ForumCommentActions;
}

export interface ForumPostDraft {
  category: string;
  title: string;
  body: string;
  createRequestKey: string;
}

export interface ForumPostParam {
  postId: string;
}

export function forumCategoryLabel(category: string): string {
  if (category === FORUM_CATEGORY_GENERAL) return '综合交流';
  if (category === FORUM_CATEGORY_EXPERIENCE) return '经验分享';
  if (category === FORUM_CATEGORY_QUESTION) return '问题求助';
  return category;
}
