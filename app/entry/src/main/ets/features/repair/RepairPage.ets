import { PAGE_PADDING } from '../../core/ui/Theme';

@Component
export struct RepairPage {
  build() {
    Column({ space: 14 }) {
      Text('工作人员工作台').fontSize(28).fontWeight(FontWeight.Bold).fontColor($r('app.color.text_primary'))
      Text('受理、状态更新与维修备案将在服务端授权和报修单模型完成后接入。')
        .fontSize(16).fontColor($r('app.color.text_secondary'))
      Text('当前状态：页面骨架，未接入业务数据')
        .fontSize(14).fontColor($r('app.color.brand'))
    }
    .width('100%').height('100%').padding(PAGE_PADDING)
    .alignItems(HorizontalAlign.Start)
    .backgroundColor($r('app.color.start_window_background'))
  }
}
