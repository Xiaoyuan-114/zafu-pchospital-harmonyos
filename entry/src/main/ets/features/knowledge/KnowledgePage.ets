import { PAGE_PADDING } from '../../core/ui/Theme';

@Component
export struct KnowledgePage {
  build() {
    Column({ space: 14 }) {
      Text('知识问答').fontSize(28).fontWeight(FontWeight.Bold).fontColor($r('app.color.text_primary'))
      Text('检索、引用和问答将在授权语料与实验服务准备好后接入。')
        .fontSize(16).fontColor($r('app.color.text_secondary'))
      Text('当前状态：页面骨架，无模拟回答')
        .fontSize(14).fontColor($r('app.color.brand'))
    }
    .width('100%').height('100%').padding(PAGE_PADDING)
    .alignItems(HorizontalAlign.Start)
    .backgroundColor($r('app.color.start_window_background'))
  }
}
