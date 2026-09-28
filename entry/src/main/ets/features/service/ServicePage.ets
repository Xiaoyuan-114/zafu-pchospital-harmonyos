import { PAGE_PADDING } from '../../core/ui/Theme';

@Component
export struct ServicePage {
  build() {
    Column({ space: 14 }) {
      Text('客户服务').fontSize(28).fontWeight(FontWeight.Bold).fontColor($r('app.color.text_primary'))
      Text('报修、预约和我的进度将在实验接口与权限契约确定后接入。')
        .fontSize(16).fontColor($r('app.color.text_secondary'))
      Text('当前状态：页面骨架，未接入业务数据')
        .fontSize(14).fontColor($r('app.color.brand'))
    }
    .width('100%').height('100%').padding(PAGE_PADDING)
    .alignItems(HorizontalAlign.Start)
    .backgroundColor($r('app.color.start_window_background'))
  }
}
