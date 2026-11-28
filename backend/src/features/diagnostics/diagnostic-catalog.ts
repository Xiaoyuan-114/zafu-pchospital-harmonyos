/**
 * 检测目录（Issue #102）。
 *
 * 这里回答的是「这个症状大概属于哪一类问题、下一步该自助处理还是到店」，
 * **不是**对硬件的检测：本系统没有读取电池循环、屏幕像素、传感器读数的能力，
 * 所以目录里的每个选项都只按用户自述归类，并在结果页明确写出这句限制。
 *
 * 目录是代码里的静态数据，不入库：改文案和判定规则应当走代码评审，
 * 而不是让运营在后台改一条记录就把所有人的结论改掉。
 */

/** 单个选项对结论的推动方向。 */
export const diagnosticSignals = ["SELF", "SERVICE", "REPAIR", "UNKNOWN"] as const;
export type DiagnosticSignal = (typeof diagnosticSignals)[number];

export interface DiagnosticOption {
  code: string;
  label: string;
  signal: DiagnosticSignal;
  /** 为什么这么判：结果页逐条展示，避免给出没有依据的结论。 */
  reason: string;
  /** 仅 SELF 选项带：可以马上自己做的步骤。 */
  steps?: string[];
}

export interface DiagnosticQuestion {
  code: string;
  title: string;
  options: DiagnosticOption[];
}

export interface DiagnosticCategory {
  code: string;
  title: string;
  /** 与服务页「获取帮助」列表一致的图标键，由 App 映射到本地图片。 */
  icon: string;
  /** 这一分类能判断什么、不能判断什么。 */
  scope: string;
  questions: DiagnosticQuestion[];
}

/**
 * 「再来一次」类追问：同一现象在重置/重启后是否复现，是把
 * 「配件或临时状态」和「硬件问题」分开的关键一问。
 */
function followUpQuestion(
  code: string,
  title: string,
  recoveredLabel: string,
  recoveredSteps: string[],
  stillSignal: DiagnosticSignal,
  stillReason: string,
): DiagnosticQuestion {
  return {
    code,
    title,
    options: [
      {
        code: "recovered",
        label: recoveredLabel,
        signal: "SELF",
        reason: "这一步能恢复正常，说明问题多半停在软件或配件层",
        steps: recoveredSteps,
      },
      {
        code: "still",
        label: "还是老样子",
        signal: stillSignal,
        reason: stillReason,
      },
      {
        code: "not_tried",
        label: "还没试过",
        signal: "UNKNOWN",
        reason: "还没做这一步，现在下结论会是猜的",
      },
    ],
  };
}

export const diagnosticCategories: DiagnosticCategory[] = [
  {
    code: "DISPLAY",
    title: "显示与触屏",
    icon: "display",
    scope: "能判断显示或触屏异常大致落在设置、应用还是硬件上；判断不了具体是哪一段排线或哪块屏幕坏了。",
    questions: [
      {
        code: "display_state",
        title: "屏幕现在是什么状态？",
        options: [
          {
            code: "cracked",
            label: "玻璃有裂痕、屏幕有黑斑或漏液",
            signal: "REPAIR",
            reason: "裂痕与漏液是物理损伤，重启和改设置都不会让它恢复",
          },
          {
            code: "artifacts",
            label: "有条纹、花屏或闪屏",
            signal: "SERVICE",
            reason: "花屏常见于屏幕排线或显示芯片，需要拆机或专用工具确认",
          },
          {
            code: "touch_dead",
            label: "某些区域点不动，或自己乱点",
            signal: "SERVICE",
            reason: "触摸失灵可能来自屏幕、排线，也可能是触摸校准，远程判断不了",
          },
          {
            code: "dim",
            label: "调到最亮还是看不清，或黑屏但有声音",
            signal: "SERVICE",
            reason: "背光或显示模组的问题需要通电检测",
          },
          {
            code: "preference",
            label: "字太小、颜色偏黄、亮度不合适",
            signal: "SELF",
            reason: "这是显示偏好，不是故障",
            steps: [
              "设置 → 显示和亮度，调整字体大小与色温",
              "关闭护眼模式后对比颜色是否仍偏黄",
              "关掉自动亮度，手动拖到中间档看是否稳定",
            ],
          },
        ],
      },
      followUpQuestion(
        "display_restart",
        "重启设备后，这个显示问题还在吗？",
        "重启后恢复正常",
        ["先观察一天；再出现时记下当时在用什么应用"],
        "SERVICE",
        "重启不改变，说明不是临时的显示状态",
      ),
    ],
  },
  {
    code: "BATTERY",
    title: "电池与充放电",
    icon: "battery",
    scope: "能区分是充电配件、使用习惯还是电池本身；读不到电池健康度和循环次数，所以不会给出「电池已损坏」的结论。",
    questions: [
      {
        code: "battery_state",
        title: "电池方面最接近哪种情况？",
        options: [
          {
            code: "swollen",
            label: "后盖鼓起、机身变形，或屏幕被顶起",
            signal: "REPAIR",
            reason: "电池鼓包有安全风险，继续充电或按压可能进一步损坏",
          },
          {
            code: "fast_drain",
            label: "满电后半天就明显掉电",
            signal: "SERVICE",
            reason: "耗电快既可能是电池老化，也可能是某个应用在后台跑，需要看实际耗电记录",
          },
          {
            code: "sudden_off",
            label: "电量还有百分之二三十就突然关机",
            signal: "SERVICE",
            reason: "电量跳变通常是电池内阻变大，属于电池层面的问题",
          },
          {
            code: "no_charge",
            label: "插上充电器没有充电提示",
            signal: "SELF",
            reason: "先用替换法排除线和充电器，这是最常见的成因",
            steps: [
              "换一根确认好的数据线和另一个充电器再试",
              "换一个插座，或换机身上的另一个接口",
              "看一下充电口里有没有灰尘或异物，关机后用干燥的软毛刷轻扫",
            ],
          },
          {
            code: "hot",
            label: "充电或使用时明显发烫",
            signal: "SELF",
            reason: "多数与散热条件和当时的负载有关",
            steps: [
              "取下保护壳，别放在被子、枕头这类不透气的地方",
              "避免边充电边玩大型游戏",
              "设置里看一下最近的高耗电应用，关掉不用的后台",
            ],
          },
        ],
      },
      followUpQuestion(
        "battery_restart",
        "换过充电配件、重启之后，问题还在吗？",
        "已经正常了",
        ["继续观察几天；若再次出现，记下当时的电量和在做什么"],
        "SERVICE",
        "换过配件仍然如此，问题更可能在机身或电池本身",
      ),
    ],
  },
  {
    code: "POWER",
    title: "开关机与运行",
    icon: "power",
    scope: "能区分完全不上电、能开机但起不来、以及开机后卡顿三类；判断不了主板上的具体故障点。",
    questions: [
      {
        code: "power_state",
        title: "开机和运行最接近哪种情况？",
        options: [
          {
            code: "no_power",
            label: "按电源键完全没反应，插电也没有任何提示",
            signal: "REPAIR",
            reason: "连充电提示都没有，通常已经不是软件层面能处理的",
          },
          {
            code: "boot_loop",
            label: "卡在开机画面反复重启",
            signal: "SERVICE",
            reason: "可能是系统损坏，也可能是存储或主板问题，需要工具判断",
          },
          {
            code: "random_reboot",
            label: "用着用着自己重启",
            signal: "SERVICE",
            reason: "偶发重启要先排除供电与过热，这两项都要看运行记录",
          },
          {
            code: "slow",
            label: "能开机，但启动慢、进桌面卡",
            signal: "SELF",
            reason: "多数是存储空间和自启应用太多",
            steps: [
              "设置 → 存储，先清出至少一成可用空间",
              "关掉不常用的开机自启应用",
              "卸载最近装过但没在用的应用后再观察",
            ],
          },
        ],
      },
      followUpQuestion(
        "power_restart",
        "清理并重启之后，还是这样吗？",
        "已经顺畅了",
        ["保持一成以上可用空间，别把存储塞满"],
        "SERVICE",
        "清理后依旧卡顿或重启，需要看系统和硬件状态",
      ),
    ],
  },
  {
    code: "NETWORK",
    title: "通讯、网络与连接",
    icon: "network",
    scope: "能区分是某个网络/配件的问题，还是整机通讯模块的问题；判断不了信号强度与基站的实际情况。",
    questions: [
      {
        code: "network_state",
        title: "网络或连接最接近哪种情况？",
        options: [
          {
            code: "no_service",
            label: "一直没有信号，或频繁显示无服务",
            signal: "SERVICE",
            reason: "先要排除 SIM 卡与运营商侧，再判断是不是通讯模块",
          },
          {
            code: "one_wifi",
            label: "只有某一个 Wi-Fi 连不上，其他能连",
            signal: "SELF",
            reason: "只影响单个网络，问题多半在那个网络或保存的配置上",
            steps: [
              "在 WLAN 列表里对该网络点「忘记」，再重新输入密码",
              "重启路由器，等指示灯稳定后再连",
              "关掉 WLAN 再打开，或开关一次飞行模式",
            ],
          },
          {
            code: "bluetooth",
            label: "蓝牙耳机、键鼠连不上或老断",
            signal: "SELF",
            reason: "配对记录失效是最常见的原因",
            steps: [
              "在蓝牙设置里删除该设备的配对记录，让配件重新进入配对模式",
              "确认配件电量充足",
              "换一台设备连同一个配件，看是配件还是手机的问题",
            ],
          },
          {
            code: "slow_data",
            label: "移动数据能上，但特别慢",
            signal: "SELF",
            reason: "先排除限速和临时网络拥堵",
            steps: [
              "关掉再打开移动数据，或开关一次飞行模式",
              "查一下本月流量是否已超量被限速",
              "换到另一个位置再测，排除当前基站拥堵",
            ],
          },
        ],
      },
      followUpQuestion(
        "network_restart",
        "按上面处理并重启后，还是连不上吗？",
        "已经能连上了",
        ["记下出问题的网络名称，下次再出现可直接对照"],
        "SERVICE",
        "换网络、换配件都无效时，才需要检查机身侧",
      ),
    ],
  },
  {
    code: "STORAGE",
    title: "系统更新与存储空间",
    icon: "storage",
    scope: "只处理空间不足、更新失败、应用闪退这类有明确操作路径的问题；系统层面的崩溃会转人工。",
    questions: [
      {
        code: "storage_state",
        title: "最接近哪种情况？",
        options: [
          {
            code: "low_space",
            label: "提示存储空间不足",
            signal: "SELF",
            reason: "空间不足有明确的自助处理路径",
            steps: [
              "设置 → 存储，看是照片、视频还是应用占用最多",
              "清理聊天软件的缓存和大文件",
              "把照片备份到云端后删除本地副本",
            ],
          },
          {
            code: "update_failed",
            label: "系统更新下载或安装失败",
            signal: "SELF",
            reason: "更新失败多数是空间、电量或网络条件不满足",
            steps: [
              "连上 Wi-Fi，电量保持在 50% 以上再重试",
              "先清出足够空间，再重新下载更新包",
              "重启后再进设置里检查更新",
            ],
          },
          {
            code: "one_app_crash",
            label: "某一个应用总闪退",
            signal: "SELF",
            reason: "只影响单个应用时，问题通常在该应用的版本或数据上",
            steps: [
              "在应用市场把该应用更新到最新版本",
              "设置 → 应用，清除该应用的缓存后重开",
              "仍不行就备份数据后卸载重装",
            ],
          },
          {
            code: "system_crash",
            label: "好几个应用都闪退，或系统整体卡死",
            signal: "SERVICE",
            reason: "影响面到系统层，需要看运行日志才能定位",
          },
        ],
      },
      followUpQuestion(
        "storage_restart",
        "清理并重启之后，还是这样吗？",
        "已经恢复",
        ["保持一成以上可用空间，更新包装完及时删掉"],
        "SERVICE",
        "清理无效说明不是空间问题",
      ),
    ],
  },
  {
    code: "ACCOUNT",
    title: "账号与登录安全",
    icon: "account",
    scope: "处理登录、验证码、权限与隐私相关的操作问题；涉及身份核实的部分只能由工作人员处理。",
    questions: [
      {
        code: "account_state",
        title: "账号方面最接近哪种情况？",
        options: [
          {
            code: "cannot_login",
            label: "忘记密码，或收不到验证码",
            signal: "SELF",
            reason: "先确认联系方式与验证方式，多数能自己解决",
            steps: [
              "确认绑定的手机号是否已停用或换号",
              "换一种验证方式（密码 / 验证码）再试一次",
              "仍进不去时联系工作人员核对身份后重置",
            ],
          },
          {
            code: "suspicious",
            label: "怀疑有人用了我的账号",
            signal: "SERVICE",
            reason: "涉及身份核实与登录记录核查，必须由工作人员处理",
          },
          {
            code: "privacy",
            label: "想知道应用收集了哪些信息",
            signal: "SELF",
            reason: "隐私说明与权限开关都在应用内可查",
            steps: [
              "在「我的 → 隐私」查看信息收集说明",
              "在系统设置里关掉不需要的权限（相机、位置、通讯录）",
            ],
          },
          {
            code: "other",
            label: "其他账号问题，说不清归哪一类",
            signal: "UNKNOWN",
            reason: "描述还不足以归类",
          },
        ],
      },
      followUpQuestion(
        "account_relogin",
        "退出账号重新登录后，问题还在吗？",
        "重新登录后正常了",
        ["记下当时的报错文字，能帮助定位是密码还是验证码环节"],
        "SERVICE",
        "重新登录仍不行，需要人工核对账号状态",
      ),
    ],
  },
];

export function findCategory(code: string): DiagnosticCategory | undefined {
  return diagnosticCategories.find((category) => category.code === code);
}

export function findQuestion(category: DiagnosticCategory, code: string): DiagnosticQuestion | undefined {
  return category.questions.find((question) => question.code === code);
}

export function findOption(question: DiagnosticQuestion, code: string): DiagnosticOption | undefined {
  return question.options.find((option) => option.code === code);
}
