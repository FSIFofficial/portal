/**
 * 本番仕様が未確定の事項について、デモで採用している仮定。
 * 後から仕様が決まった際はここを変更する。
 */
export const DEMO_ASSUMPTIONS = {
  /** 代表はデモ上1名 */
  singleRepresentative: true,
  /** 事業部長解除時もツール内部役割の既存付与は保持する */
  keepToolGrantsOnDismiss: true,
  /** 手動で役割を下げても、他の付与元が上位なら最上位を適用する */
  highestRoleWinsOverManualRole: true,
  /** 再加入時は退会前の個別権限を復活させず、所属設定から再付与する */
  rejoinRegrantsFromTemplates: true,
  /** 兼務者への個人全体の上書きは、全所属の管理範囲がないとロックする（保守的な仮仕様） */
  requireAllDepartmentsForOverride: true,
  /** テンプレートをOFFにしても既存付与は削除しない */
  templateOffKeepsExistingGrants: true,
} as const

export const DISMISS_NOTICE = "この操作では組織上の管理権限のみ解除します。ツール権限は別途変更できます。"
export const TRANSFER_WARNING = "譲渡すると、あなた自身では権限を戻せません。"
