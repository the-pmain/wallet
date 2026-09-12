/**
 * Золотое свечение Super Admin.
 *
 * Тот же рецепт, что в шапке кабинета: янтарный текст и многослойный
 * bloom. PIN-экран (заголовок, щит, заполненные точки) и шапка
 * читают эти классы, чтобы метка не расходилась между входом и
 * кабинетом.
 */

export const SUPER_ADMIN_GLOW_TEXT =
  'text-amber-300 [text-shadow:0_0_10px_rgba(251,191,36,1),0_0_28px_rgba(245,158,11,0.9),0_0_56px_rgba(234,179,8,0.65),0_0_88px_rgba(202,138,4,0.45)]'

export const SUPER_ADMIN_GLOW_ICON =
  '[filter:drop-shadow(0_0_8px_rgba(251,191,36,1))_drop-shadow(0_0_22px_rgba(245,158,11,0.9))_drop-shadow(0_0_44px_rgba(234,179,8,0.65))]'

export const SUPER_ADMIN_GLOW_DOT =
  'border-amber-300 bg-amber-300 [box-shadow:0_0_10px_rgba(251,191,36,1),0_0_22px_rgba(245,158,11,0.9)]'
