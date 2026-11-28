import { ApiRequestError, isSessionExpiredCode } from '../../core/network/ApiClient';
import { isNetworkErrorCode } from '../knowledge/KnowledgeFlow';
import {
  CARD_PADDING,
  CARD_RADIUS,
  CONTROL_HEIGHT,
  CONTROL_RADIUS,
  FONT_HEADING,
  FONT_NOTE,
  FONT_SUBTITLE,
  FONT_TEXT,
  GAP_LG,
  GAP_SM,
} from '../../core/ui/Theme';
import { DEVICE_LIMITS, DeviceCreateRequest } from './DeviceContract';

/** 表单字段级错误：键与后端 fieldErrors 同名，便于把服务端错误直接落到输入框下方。 */
export type DeviceFieldErrorMap = Record<string, string>;

/** 日历日期：与后端 parseCalendarDate 同一套规则（格式 + 真实日期都要成立）。 */
const CALENDAR_DATE: RegExp = /^(\d{4})-(\d{2})-(\d{2})$/;

function isValidCalendarDate(value: string): boolean {
  const matched: RegExpMatchArray | null = value.match(CALENDAR_DATE);
  if (matched === null) {
    return false;
  }
  const year: number = Number(matched[1]);
  const month: number = Number(matched[2]);
  const day: number = Number(matched[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  // 用 UTC 构造再回读，`2026-02-30` 这类不存在的日期会被日期进位暴露出来。
  const parsed: Date = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

/** 今天的日历日 `YYYY-MM-DD`，用于「购买日期不能晚于今天」的前置拦截。 */
function todayCalendarDate(): string {
  const now: Date = new Date();
  const year: number = now.getFullYear();
  const month: number = now.getMonth() + 1;
  const day: number = now.getDate();
  const m: string = month < 10 ? `0${month}` : `${month}`;
  const d: string = day < 10 ? `0${day}` : `${day}`;
  return `${year}-${m}-${d}`;
}

/**
 * 设备绑定 / 编辑表单（Issue #102）。
 *
 * 新增与编辑共用一个表单：字段完全一致，区别只在 `deviceId` 是否为空
 * （空 = 新增，非空 = 编辑）。提交动作由父组件注入，表单本身不发请求 ——
 * 这样列表页与详情页可以各自决定提交成功后刷新哪一部分。
 *
 * 提交前做一遍本地校验，**但不把本地校验当成通过条件**：
 * 服务端仍会独立校验，返回的 `fieldErrors` 会覆盖本地结果。
 */
@Component
export struct DeviceForm {
  /** 空串 = 新增；非空 = 编辑该设备。 */
  @Prop deviceId: string = '';
  @Prop initialLabel: string = '';
  @Prop initialBrand: string = '';
  @Prop initialModel: string = '';
  @Prop initialSerial: string = '';
  @Prop initialPurchaseOn: string = '';
  /** 提交：父组件据 deviceId 决定调新增还是编辑。 */
  submit: (deviceId: string, request: DeviceCreateRequest) => Promise<void> = async () => {
  };
  /** 成功后的收尾（收起表单、刷新列表）。 */
  onSaved: () => Promise<void> = async () => {
  };
  onCancel: () => void = () => {
  };
  onSessionExpired: () => void = () => {
  };
  @State label: string = '';
  @State brand: string = '';
  @State model: string = '';
  @State serial: string = '';
  @State purchaseOn: string = '';
  @State busy: boolean = false;
  @State errorText: string = '';
  @State fieldErrors: DeviceFieldErrorMap = {};

  aboutToAppear(): void {
    this.label = this.initialLabel;
    this.brand = this.initialBrand;
    this.model = this.initialModel;
    this.serial = this.initialSerial;
    this.purchaseOn = this.initialPurchaseOn;
  }

  private fieldError(name: string): string {
    const value: string | undefined = this.fieldErrors[name];
    return value === undefined ? '' : value;
  }

  /** 本地校验：只拦「明显不合法」，返回空 map 表示可以发请求。 */
  private localValidation(): DeviceFieldErrorMap {
    const errors: DeviceFieldErrorMap = {};
    const label: string = this.label.trim();
    const brand: string = this.brand.trim();
    const model: string = this.model.trim();
    const serial: string = this.serial.trim();
    const purchaseOn: string = this.purchaseOn.trim();

    if (label === '') {
      errors.label = '请填写设备名称';
    } else if (label.length > DEVICE_LIMITS.labelMaxLength) {
      errors.label = `设备名称不能超过 ${DEVICE_LIMITS.labelMaxLength} 字`;
    }
    if (brand === '') {
      errors.brand = '请填写品牌';
    } else if (brand.length > DEVICE_LIMITS.brandMaxLength) {
      errors.brand = `品牌不能超过 ${DEVICE_LIMITS.brandMaxLength} 字`;
    }
    if (model === '') {
      errors.model = '请填写型号';
    } else if (model.length > DEVICE_LIMITS.modelMaxLength) {
      errors.model = `型号不能超过 ${DEVICE_LIMITS.modelMaxLength} 字`;
    }
    if (serial.length > DEVICE_LIMITS.serialNumberMaxLength) {
      errors.serialNumber = `序列号不能超过 ${DEVICE_LIMITS.serialNumberMaxLength} 字`;
    }
    if (purchaseOn !== '') {
      if (!isValidCalendarDate(purchaseOn)) {
        errors.purchaseOn = '购买日期格式应为 YYYY-MM-DD';
      } else if (purchaseOn > todayCalendarDate()) {
        errors.purchaseOn = '购买日期不能晚于今天';
      }
    }
    return errors;
  }

  /** 把服务端返回的 fieldErrors（`Record<string, string[]>`）压成单条提示。 */
  private readServerFieldErrors(error: ApiRequestError): DeviceFieldErrorMap {
    const raw: Record<string, string[]> | undefined = error.fieldErrors;
    const result: DeviceFieldErrorMap = {};
    if (raw === undefined) {
      return result;
    }
    const keys: string[] = Object.keys(raw);
    for (const key of keys) {
      const messages: string[] = raw[key];
      if (messages.length > 0) {
        result[key] = messages[0];
      }
    }
    return result;
  }

  private async handleSubmit(): Promise<void> {
    if (this.busy) {
      return;
    }
    this.errorText = '';
    const local: DeviceFieldErrorMap = this.localValidation();
    this.fieldErrors = local;
    if (Object.keys(local).length > 0) {
      return;
    }

    this.busy = true;
    try {
      const request: DeviceCreateRequest = {
        label: this.label.trim(),
        brand: this.brand.trim(),
        model: this.model.trim(),
      };
      // 选填字段留空时**不带这个键**，避免提交空串被服务端当成「填了一个空值」。
      const serial: string = this.serial.trim();
      if (serial !== '') {
        request.serialNumber = serial;
      }
      const purchaseOn: string = this.purchaseOn.trim();
      if (purchaseOn !== '') {
        request.purchaseOn = purchaseOn;
      }
      await this.submit(this.deviceId, request);
      this.fieldErrors = {};
      await this.onSaved();
    } catch (error) {
      if (error instanceof ApiRequestError) {
        if (isSessionExpiredCode(error.code)) {
          this.onSessionExpired();
          return;
        }
        // 序列号重复是业务冲突而不是字段格式错，落到序列号输入框下方最直观。
        if (error.code === 'DEVICE_SERIAL_CONFLICT') {
          const conflict: DeviceFieldErrorMap = {};
          conflict.serialNumber = error.message;
          this.fieldErrors = conflict;
          return;
        }
        const serverFields: DeviceFieldErrorMap = this.readServerFieldErrors(error);
        this.fieldErrors = serverFields;
        this.errorText = Object.keys(serverFields).length > 0
          ? ''
          : (isNetworkErrorCode(error.code) ? `${error.message}（请检查网络与服务器地址后重试）` : error.message);
      } else {
        this.errorText = '保存失败，请重试';
      }
    } finally {
      this.busy = false;
    }
  }

  @Builder
  labeledInput(label: string, placeholder: string, value: string, name: string, maxLength: number,
    onChange: (v: string) => void) {
    Column({ space: GAP_SM }) {
      Text(label)
        .fontSize(FONT_TEXT)
        .fontColor($r('app.color.text_secondary'))
        .width('100%')
        .textAlign(TextAlign.Start)
      TextInput({ text: value, placeholder: placeholder })
        .maxLength(maxLength)
        .height(CONTROL_HEIGHT)
        .backgroundColor($r('app.color.field_bg'))
        .borderRadius(CONTROL_RADIUS)
        .onChange((next: string) => {
          onChange(next);
        })
      if (this.fieldError(name) !== '') {
        Text(this.fieldError(name))
          .fontSize(FONT_NOTE)
          .fontColor($r('app.color.danger'))
          .width('100%')
          .textAlign(TextAlign.Start)
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }

  build() {
    Column({ space: GAP_LG }) {
      Text(this.deviceId === '' ? '添加设备' : '编辑设备信息')
        .fontSize(FONT_HEADING)
        .fontWeight(FontWeight.Medium)
        .fontColor($r('app.color.text_primary'))
        .width('100%')
        .textAlign(TextAlign.Start)

      this.labeledInput('设备名称（必填）', '如 我的办公本', this.label, 'label', DEVICE_LIMITS.labelMaxLength,
        (v: string) => {
          this.label = v;
        })
      this.labeledInput('品牌（必填）', '如 ThinkPad', this.brand, 'brand', DEVICE_LIMITS.brandMaxLength,
        (v: string) => {
          this.brand = v;
        })
      this.labeledInput('型号（必填）', '如 X1 Carbon Gen 11', this.model, 'model', DEVICE_LIMITS.modelMaxLength,
        (v: string) => {
          this.model = v;
        })
      this.labeledInput('序列号（选填）', '机身底部或包装盒上的 SN', this.serial, 'serialNumber',
        DEVICE_LIMITS.serialNumberMaxLength, (v: string) => {
          this.serial = v;
        })
      this.labeledInput('购买日期（选填）', 'YYYY-MM-DD，如 2026-03-01', this.purchaseOn, 'purchaseOn', 10,
        (v: string) => {
          this.purchaseOn = v;
        })

      Text('序列号用于到店核对，填错不影响保修判断：权益由工作人员按机身登记。')
        .fontSize(FONT_NOTE)
        .fontColor($r('app.color.text_secondary'))
        .width('100%')
        .textAlign(TextAlign.Start)

      if (this.errorText !== '') {
        Text(this.errorText)
          .fontSize(FONT_TEXT)
          .fontColor($r('app.color.danger'))
          .width('100%')
          .textAlign(TextAlign.Start)
      }

      Button() {
        Row({ space: GAP_SM }) {
          if (this.busy) {
            LoadingProgress()
              .width(18)
              .height(18)
              .color(Color.White)
          }
          Text(this.busy ? '保存中…' : (this.deviceId === '' ? '保存设备' : '保存修改'))
            .fontSize(FONT_SUBTITLE)
            .fontColor(Color.White)
        }
      }
      .width('100%')
      .height(CONTROL_HEIGHT)
      .backgroundColor($r('app.color.brand'))
      .enabled(!this.busy)
      .onClick(() => {
        this.handleSubmit();
      })

      Button('取消')
        .width('100%')
        .height(CONTROL_HEIGHT)
        .fontSize(FONT_TEXT)
        .fontColor($r('app.color.text_secondary'))
        .backgroundColor(Color.Transparent)
        .enabled(!this.busy)
        .onClick(() => {
          this.onCancel();
        })
    }
    .width('100%')
    .padding(CARD_PADDING)
    .backgroundColor($r('app.color.surface'))
    .borderRadius(CARD_RADIUS)
    .alignItems(HorizontalAlign.Start)
  }
}
