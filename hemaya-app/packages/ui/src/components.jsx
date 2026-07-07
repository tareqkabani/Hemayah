'use client';
/* ============================================================
   مكتبة نظام «كود» (Platforms Code) — منقولة من _ds_bundle.js
   نفس مكوّنات التصميم الأصليّة (React) بحاويات IIFE الأصليّة سليمة
   (تحفظ الثوابت المشتركة مثل TONES). لا تُعدّل يدوياً.
   ============================================================ */
import React from 'react';
const __ds_ns = { __errors: [] };
const __ds_scope = {};


(__ds_ns.__errors = __ds_ns.__errors || []);

// components/data/Accordion.jsx
try { (() => {
/**
 * Platforms Code — Accordion
 * Stacked expand/collapse panels. Single or multi-open.
 */
function Accordion({
  items = [],
  allowMultiple = false,
  defaultOpen = [],
  style = {}
}) {
  const [open, setOpen] = React.useState(() => new Set(defaultOpen));
  const toggle = id => {
    setOpen(prev => {
      const next = new Set(allowMultiple ? prev : []);
      if (prev.has(id)) next.delete(id);else next.add(id);
      return next;
    });
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, items.map((item, i) => {
    const id = item.id ?? i;
    const isOpen = open.has(id);
    return /*#__PURE__*/React.createElement("div", {
      key: id,
      style: {
        borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)'
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => toggle(id),
      "aria-expanded": isOpen,
      style: {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        padding: '16px 20px',
        background: isOpen ? 'var(--surface-subtle)' : 'var(--surface-card)',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'start',
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--size-16)',
        fontWeight: 'var(--weight-medium)',
        color: 'var(--text-strong)'
      }
    }, /*#__PURE__*/React.createElement("span", null, item.title), /*#__PURE__*/React.createElement("span", {
      className: "material-symbols-rounded",
      style: {
        fontSize: '24px',
        color: 'var(--text-secondary)',
        transition: 'transform var(--duration-base) var(--ease-standard)',
        transform: isOpen ? 'rotate(180deg)' : 'none'
      }
    }, "expand_more")), isOpen && /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '4px 20px 20px',
        fontSize: 'var(--size-16)',
        color: 'var(--text-body)',
        lineHeight: 'var(--leading-normal)'
      }
    }, item.content));
  }));
}
Object.assign(__ds_scope, { Accordion });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Accordion.jsx", error: String((e && e.message) || e) }); }

// components/data/Avatar.jsx
try { (() => {
/**
 * Platforms Code — Avatar
 * User / entity identity token. Image, initials, or icon fallback.
 */
function Avatar({
  src,
  name = '',
  size = 'md',
  icon = 'person',
  shape = 'circle',
  style = {}
}) {
  const sizes = {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 48,
    xl: 64
  };
  const px = sizes[size] || sizes.md;
  const initials = name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: `${px}px`,
      height: `${px}px`,
      flexShrink: 0,
      borderRadius: shape === 'circle' ? 'var(--radius-full)' : 'var(--radius-md)',
      background: 'var(--green-10)',
      color: 'var(--green-80)',
      fontFamily: 'var(--font-sans)',
      fontSize: `${Math.round(px * 0.4)}px`,
      fontWeight: 'var(--weight-semibold)',
      overflow: 'hidden',
      ...style
    }
  }, src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: name,
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover'
    }
  }) : initials ? initials : /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-rounded",
    style: {
      fontSize: `${Math.round(px * 0.55)}px`
    }
  }, icon));
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/data/Card.jsx
try { (() => {
/**
 * Platforms Code — Card
 * Surface container for grouped content. Optional hover lift for
 * clickable service / link cards.
 */
function Card({
  children,
  interactive = false,
  padding = 'md',
  onClick,
  style = {}
}) {
  const [hover, setHover] = React.useState(false);
  const pads = {
    none: 0,
    sm: '16px',
    md: '24px',
    lg: '32px'
  };
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      padding: pads[padding],
      fontFamily: 'var(--font-sans)',
      boxShadow: interactive && hover ? 'var(--shadow-md)' : 'var(--shadow-xs)',
      transform: interactive && hover ? 'translateY(-2px)' : 'none',
      borderColor: interactive && hover ? 'var(--border-default)' : 'var(--border-subtle)',
      cursor: interactive ? 'pointer' : 'default',
      transition: 'box-shadow var(--duration-base) var(--ease-standard), transform var(--duration-base) var(--ease-standard), border-color var(--duration-base) var(--ease-standard)',
      ...style
    }
  }, children);
}

/** Optional structured slots */
function CardHeader({
  children,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '12px',
      ...style
    }
  }, children);
}
function CardTitle({
  children,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      fontSize: 'var(--size-18)',
      fontWeight: 'var(--weight-semibold)',
      color: 'var(--text-strong)',
      ...style
    }
  }, children);
}
function CardBody({
  children,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--size-16)',
      color: 'var(--text-body)',
      lineHeight: 'var(--leading-normal)',
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Card, CardHeader, CardTitle, CardBody });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Card.jsx", error: String((e && e.message) || e) }); }

// components/feedback/InlineAlert.jsx
try { (() => {
/**
 * Platforms Code — InlineAlert (a.k.a. Inline Notification)
 * Contextual banner placed within page flow. Left status accent + icon.
 */
const KINDS = {
  info: {
    color: 'var(--color-info)',
    bg: 'var(--color-info-subtle)',
    icon: 'info'
  },
  success: {
    color: 'var(--color-success)',
    bg: 'var(--color-success-subtle)',
    icon: 'check_circle'
  },
  warning: {
    color: 'var(--color-warning)',
    bg: 'var(--color-warning-subtle)',
    icon: 'warning'
  },
  error: {
    color: 'var(--color-error)',
    bg: 'var(--color-error-subtle)',
    icon: 'error'
  }
};
function InlineAlert({
  kind = 'info',
  title,
  children,
  onClose,
  style = {}
}) {
  const k = KINDS[kind] || KINDS.info;
  return /*#__PURE__*/React.createElement("div", {
    role: "status",
    style: {
      display: 'flex',
      gap: '12px',
      padding: '14px 16px',
      background: k.bg,
      borderInlineStart: `4px solid ${k.color}`,
      borderRadius: 'var(--radius-md)',
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-rounded",
    "aria-hidden": "true",
    style: {
      fontSize: '22px',
      color: k.color,
      flexShrink: 0,
      fontVariationSettings: "'FILL' 1"
    }
  }, k.icon), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, title && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--size-14)',
      fontWeight: 'var(--weight-semibold)',
      color: 'var(--text-strong)',
      marginBottom: children ? '2px' : 0
    }
  }, title), children && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--size-14)',
      color: 'var(--text-body)',
      lineHeight: 'var(--leading-normal)'
    }
  }, children)), onClose && /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    "aria-label": "Dismiss",
    style: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: 0,
      display: 'flex',
      color: 'var(--text-secondary)',
      alignSelf: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-rounded",
    style: {
      fontSize: '20px'
    }
  }, "close")));
}
Object.assign(__ds_scope, { InlineAlert });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/InlineAlert.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Modal.jsx
try { (() => {
/**
 * Platforms Code — Modal / Dialog
 * Centered overlay for focused tasks and confirmations.
 * Controlled via `open`; renders a scrim + card with optional footer.
 */
function Modal({
  open,
  onClose,
  title,
  children,
  footer = null,
  size = 'md',
  style = {}
}) {
  if (!open) return null;
  const widths = {
    sm: '420px',
    md: '560px',
    lg: '760px'
  };
  return /*#__PURE__*/React.createElement("div", {
    role: "dialog",
    "aria-modal": "true",
    onClick: onClose,
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 'var(--z-modal)',
      background: 'rgba(10, 14, 22, 0.55)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: 'var(--font-sans)',
      animation: 'pc-fade var(--duration-base) var(--ease-entrance)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width: '100%',
      maxWidth: widths[size],
      maxHeight: '90vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--surface-card)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-xl)',
      overflow: 'hidden',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: '16px',
      padding: '20px 24px',
      borderBottom: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontSize: 'var(--size-20)',
      fontWeight: 'var(--weight-semibold)',
      color: 'var(--text-strong)'
    }
  }, title), onClose && /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    "aria-label": "Close",
    style: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: 0,
      display: 'flex',
      color: 'var(--text-secondary)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-rounded",
    style: {
      fontSize: '24px'
    }
  }, "close"))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '20px 24px',
      overflowY: 'auto',
      fontSize: 'var(--size-16)',
      color: 'var(--text-body)',
      lineHeight: 'var(--leading-normal)'
    }
  }, children), footer && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '12px',
      padding: '16px 24px',
      borderTop: '1px solid var(--border-subtle)',
      background: 'var(--surface-subtle)'
    }
  }, footer)), /*#__PURE__*/React.createElement("style", null, `@keyframes pc-fade { from { opacity: 0 } to { opacity: 1 } }`));
}
Object.assign(__ds_scope, { Modal });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Modal.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Tag.jsx
try { (() => {
/**
 * Platforms Code — Tag / Chip
 * Compact label for metadata, categories and statuses.
 */
const TONES = {
  neutral: {
    bg: 'var(--neutral-100)',
    color: 'var(--neutral-700)'
  },
  primary: {
    bg: 'var(--green-10)',
    color: 'var(--green-80)'
  },
  success: {
    bg: 'var(--success-10)',
    color: 'var(--success-70)'
  },
  warning: {
    bg: 'var(--warning-10)',
    color: 'var(--warning-70)'
  },
  error: {
    bg: 'var(--error-10)',
    color: 'var(--error-70)'
  },
  info: {
    bg: 'var(--info-10)',
    color: 'var(--info-70)'
  }
};
function Tag({
  children,
  tone = 'neutral',
  size = 'md',
  iconLeft = null,
  onRemove,
  style = {}
}) {
  const t = TONES[tone] || TONES.neutral;
  const pad = size === 'sm' ? '2px 8px' : '4px 12px';
  const fs = size === 'sm' ? 'var(--size-12)' : 'var(--size-14)';
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: pad,
      background: t.bg,
      color: t.color,
      fontFamily: 'var(--font-sans)',
      fontSize: fs,
      fontWeight: 'var(--weight-medium)',
      borderRadius: 'var(--radius-full)',
      lineHeight: 1.4,
      whiteSpace: 'nowrap',
      ...style
    }
  }, iconLeft, children, onRemove && /*#__PURE__*/React.createElement("button", {
    onClick: onRemove,
    "aria-label": "Remove",
    style: {
      background: 'none',
      border: 'none',
      padding: 0,
      margin: 0,
      cursor: 'pointer',
      display: 'flex',
      color: 'inherit',
      opacity: 0.7
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-rounded",
    style: {
      fontSize: '16px'
    }
  }, "close")));
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Tag.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Tooltip.jsx
try { (() => {
/**
 * Platforms Code — Tooltip
 * Hover/focus label on a dark surface. Positions around the trigger.
 */
function Tooltip({
  content,
  placement = 'top',
  children,
  style = {}
}) {
  const [open, setOpen] = React.useState(false);
  const pos = {
    top: {
      bottom: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      marginBottom: '8px'
    },
    bottom: {
      top: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      marginTop: '8px'
    },
    left: {
      right: '100%',
      top: '50%',
      transform: 'translateY(-50%)',
      marginRight: '8px'
    },
    right: {
      left: '100%',
      top: '50%',
      transform: 'translateY(-50%)',
      marginLeft: '8px'
    }
  };
  return /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      display: 'inline-flex',
      ...style
    },
    onMouseEnter: () => setOpen(true),
    onMouseLeave: () => setOpen(false),
    onFocus: () => setOpen(true),
    onBlur: () => setOpen(false)
  }, children, open && /*#__PURE__*/React.createElement("span", {
    role: "tooltip",
    style: {
      position: 'absolute',
      zIndex: 'var(--z-tooltip)',
      ...pos[placement],
      background: 'var(--surface-inverse)',
      color: 'var(--text-on-color)',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--size-12)',
      fontWeight: 'var(--weight-medium)',
      lineHeight: 1.4,
      padding: '6px 10px',
      borderRadius: 'var(--radius-sm)',
      boxShadow: 'var(--shadow-md)',
      whiteSpace: 'nowrap',
      pointerEvents: 'none'
    }
  }, content));
}
Object.assign(__ds_scope, { Tooltip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Tooltip.jsx", error: String((e && e.message) || e) }); }

// components/forms/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Platforms Code — Button
 * Primary action control. Saudi-green primary, neutral secondary,
 * low-emphasis ghost, and destructive danger. Touch-friendly heights.
 */
function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  fullWidth = false,
  iconLeft = null,
  iconRight = null,
  type = 'button',
  onClick,
  style = {},
  ...rest
}) {
  const heights = {
    sm: 'var(--control-height-sm)',
    md: 'var(--control-height-md)',
    lg: 'var(--control-height-lg)'
  };
  const pads = {
    sm: '0 16px',
    md: '0 20px',
    lg: '0 28px'
  };
  const fontSizes = {
    sm: 'var(--size-14)',
    md: 'var(--size-16)',
    lg: 'var(--size-16)'
  };
  const variants = {
    primary: {
      background: 'var(--color-primary)',
      color: 'var(--color-on-primary)',
      border: '1px solid var(--color-primary)'
    },
    secondary: {
      background: 'var(--neutral-0)',
      color: 'var(--text-strong)',
      border: '1px solid var(--border-default)'
    },
    ghost: {
      background: 'transparent',
      color: 'var(--color-primary)',
      border: '1px solid transparent'
    },
    danger: {
      background: 'var(--color-error)',
      color: 'var(--neutral-0)',
      border: '1px solid var(--color-error)'
    }
  };
  const [hover, setHover] = React.useState(false);
  const hoverBg = {
    primary: 'var(--color-primary-hover)',
    secondary: 'var(--surface-hover)',
    ghost: 'var(--color-primary-subtle)',
    danger: 'var(--error-70)'
  };
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    height: heights[size],
    padding: pads[size],
    width: fullWidth ? '100%' : 'auto',
    fontFamily: 'var(--font-sans)',
    fontSize: fontSizes[size],
    fontWeight: 'var(--weight-medium)',
    lineHeight: 1,
    borderRadius: 'var(--radius-md)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    transition: 'background var(--duration-fast) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard)',
    whiteSpace: 'nowrap',
    ...variants[variant],
    ...(hover && !disabled ? {
      background: hoverBg[variant]
    } : null),
    ...style
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: base
  }, rest), iconLeft, children, iconRight);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Button.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Platforms Code — Checkbox
 * Square selection control with a Material check glyph. Supports
 * indeterminate state. Label sits inline (RTL-aware).
 */
function Checkbox({
  label,
  checked = false,
  indeterminate = false,
  onChange,
  disabled = false,
  id,
  style = {},
  ...rest
}) {
  const reactId = React.useId();
  const fieldId = id || reactId;
  const on = checked || indeterminate;
  return /*#__PURE__*/React.createElement("label", {
    htmlFor: fieldId,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '10px',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--size-16)',
      color: disabled ? 'var(--text-disabled)' : 'var(--text-body)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      ...style
    }
  }, /*#__PURE__*/React.createElement("input", _extends({
    id: fieldId,
    type: "checkbox",
    checked: checked,
    disabled: disabled,
    onChange: onChange,
    style: {
      position: 'absolute',
      opacity: 0,
      width: 0,
      height: 0
    }
  }, rest)), /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '20px',
      height: '20px',
      flexShrink: 0,
      borderRadius: 'var(--radius-xs)',
      border: `2px solid ${on ? 'var(--color-primary)' : 'var(--border-strong)'}`,
      background: on ? 'var(--color-primary)' : 'transparent',
      color: 'var(--neutral-0)',
      transition: 'background var(--duration-fast) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard)'
    }
  }, indeterminate ? /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-rounded",
    style: {
      fontSize: '18px',
      fontVariationSettings: "'wght' 600"
    }
  }, "remove") : checked ? /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-rounded",
    style: {
      fontSize: '18px',
      fontVariationSettings: "'wght' 600"
    }
  }, "check") : null), label && /*#__PURE__*/React.createElement("span", null, label));
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/Radio.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Platforms Code — Radio / RadioGroup
 * Single-choice control. Use RadioGroup to manage selection across options.
 */
function Radio({
  label,
  checked = false,
  onChange,
  disabled = false,
  name,
  value,
  id,
  style = {},
  ...rest
}) {
  const reactId = React.useId();
  const fieldId = id || reactId;
  return /*#__PURE__*/React.createElement("label", {
    htmlFor: fieldId,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '10px',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--size-16)',
      color: disabled ? 'var(--text-disabled)' : 'var(--text-body)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      ...style
    }
  }, /*#__PURE__*/React.createElement("input", _extends({
    id: fieldId,
    type: "radio",
    name: name,
    value: value,
    checked: checked,
    disabled: disabled,
    onChange: onChange,
    style: {
      position: 'absolute',
      opacity: 0,
      width: 0,
      height: 0
    }
  }, rest)), /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '20px',
      height: '20px',
      flexShrink: 0,
      borderRadius: 'var(--radius-full)',
      border: `2px solid ${checked ? 'var(--color-primary)' : 'var(--border-strong)'}`,
      background: 'transparent',
      transition: 'border-color var(--duration-fast) var(--ease-standard)'
    }
  }, checked && /*#__PURE__*/React.createElement("span", {
    style: {
      width: '10px',
      height: '10px',
      borderRadius: 'var(--radius-full)',
      background: 'var(--color-primary)'
    }
  })), label && /*#__PURE__*/React.createElement("span", null, label));
}
function RadioGroup({
  name,
  value,
  onChange,
  options = [],
  legend,
  direction = 'column',
  style = {}
}) {
  const normalized = options.map(o => typeof o === 'string' ? {
    value: o,
    label: o
  } : o);
  const groupName = name || React.useId();
  return /*#__PURE__*/React.createElement("fieldset", {
    style: {
      border: 'none',
      margin: 0,
      padding: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      ...style
    }
  }, legend && /*#__PURE__*/React.createElement("legend", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--type-label-size)',
      fontWeight: 'var(--weight-medium)',
      color: 'var(--text-strong)',
      padding: 0,
      marginBottom: '4px'
    }
  }, legend), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: direction,
      gap: direction === 'row' ? '24px' : '12px',
      flexWrap: 'wrap'
    }
  }, normalized.map(o => /*#__PURE__*/React.createElement(Radio, {
    key: o.value,
    name: groupName,
    value: o.value,
    label: o.label,
    checked: value === o.value,
    disabled: o.disabled,
    onChange: () => onChange && onChange(o.value)
  }))));
}
Object.assign(__ds_scope, { Radio, RadioGroup });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Radio.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Platforms Code — Select
 * Native dropdown styled to match TextInput, with a chevron affordance.
 */
function Select({
  label,
  value,
  onChange,
  options = [],
  placeholder = 'Select…',
  helperText = '',
  invalid = false,
  errorText = '',
  disabled = false,
  required = false,
  size = 'md',
  id,
  style = {},
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const heights = {
    sm: 'var(--control-height-sm)',
    md: 'var(--control-height-md)',
    lg: 'var(--control-height-lg)'
  };
  const reactId = React.useId();
  const fieldId = id || reactId;
  const borderColor = invalid ? 'var(--color-error)' : focus ? 'var(--border-focus)' : 'var(--field-border)';
  const normalized = options.map(o => typeof o === 'string' ? {
    value: o,
    label: o
  } : o);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      fontFamily: 'var(--font-sans)',
      width: '100%',
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: fieldId,
    style: {
      fontSize: 'var(--type-label-size)',
      fontWeight: 'var(--weight-medium)',
      color: 'var(--text-strong)'
    }
  }, label, required && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--color-error)',
      marginInlineStart: '4px'
    }
  }, "*")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("select", _extends({
    id: fieldId,
    value: value,
    onChange: onChange,
    disabled: disabled,
    "aria-invalid": invalid,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      width: '100%',
      height: heights[size],
      padding: '0 40px 0 14px',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--size-16)',
      color: value ? 'var(--text-strong)' : 'var(--field-placeholder)',
      background: disabled ? 'var(--surface-subtle)' : 'var(--field-bg)',
      border: `1px solid ${borderColor}`,
      borderRadius: 'var(--radius-md)',
      outline: 'none',
      appearance: 'none',
      WebkitAppearance: 'none',
      cursor: disabled ? 'not-allowed' : 'pointer',
      boxShadow: focus && !invalid ? 'var(--focus-ring)' : 'none',
      transition: 'border-color var(--duration-fast) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard)'
    }
  }, rest), placeholder && /*#__PURE__*/React.createElement("option", {
    value: "",
    disabled: true
  }, placeholder), normalized.map(o => /*#__PURE__*/React.createElement("option", {
    key: o.value,
    value: o.value
  }, o.label))), /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-rounded",
    "aria-hidden": "true",
    style: {
      position: 'absolute',
      insetInlineEnd: '12px',
      fontSize: '20px',
      color: 'var(--text-secondary)',
      pointerEvents: 'none'
    }
  }, "expand_more")), invalid && errorText ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--type-caption-size)',
      color: 'var(--color-error)'
    }
  }, errorText) : helperText ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--type-caption-size)',
      color: 'var(--text-secondary)'
    }
  }, helperText) : null);
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Platforms Code — Switch
 * Binary on/off toggle for immediate settings. Track fills green when on.
 */
function Switch({
  label,
  checked = false,
  onChange,
  disabled = false,
  id,
  style = {},
  ...rest
}) {
  const reactId = React.useId();
  const fieldId = id || reactId;
  return /*#__PURE__*/React.createElement("label", {
    htmlFor: fieldId,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '12px',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--size-16)',
      color: disabled ? 'var(--text-disabled)' : 'var(--text-body)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.6 : 1,
      ...style
    }
  }, /*#__PURE__*/React.createElement("input", _extends({
    id: fieldId,
    type: "checkbox",
    role: "switch",
    checked: checked,
    disabled: disabled,
    onChange: onChange,
    style: {
      position: 'absolute',
      opacity: 0,
      width: 0,
      height: 0
    }
  }, rest)), /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      position: 'relative',
      width: '44px',
      height: '24px',
      flexShrink: 0,
      borderRadius: 'var(--radius-full)',
      background: checked ? 'var(--color-primary)' : 'var(--neutral-300)',
      transition: 'background var(--duration-base) var(--ease-standard)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: '2px',
      insetInlineStart: checked ? '22px' : '2px',
      width: '20px',
      height: '20px',
      borderRadius: 'var(--radius-full)',
      background: 'var(--neutral-0)',
      boxShadow: 'var(--shadow-sm)',
      transition: 'inset-inline-start var(--duration-base) var(--ease-standard)'
    }
  })), label && /*#__PURE__*/React.createElement("span", null, label));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/forms/TextArea.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Platforms Code — TextArea
 * Multi-line field sharing TextInput's label / helper / error pattern.
 */
function TextArea({
  label,
  value,
  onChange,
  placeholder = '',
  helperText = '',
  invalid = false,
  errorText = '',
  disabled = false,
  required = false,
  rows = 4,
  id,
  style = {},
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const reactId = React.useId();
  const fieldId = id || reactId;
  const borderColor = invalid ? 'var(--color-error)' : focus ? 'var(--border-focus)' : 'var(--field-border)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      fontFamily: 'var(--font-sans)',
      width: '100%',
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: fieldId,
    style: {
      fontSize: 'var(--type-label-size)',
      fontWeight: 'var(--weight-medium)',
      color: 'var(--text-strong)'
    }
  }, label, required && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--color-error)',
      marginInlineStart: '4px'
    }
  }, "*")), /*#__PURE__*/React.createElement("textarea", _extends({
    id: fieldId,
    value: value,
    onChange: onChange,
    placeholder: placeholder,
    disabled: disabled,
    rows: rows,
    "aria-invalid": invalid,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      width: '100%',
      padding: '12px 14px',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--size-16)',
      lineHeight: 'var(--leading-normal)',
      color: 'var(--text-strong)',
      background: disabled ? 'var(--surface-subtle)' : 'var(--field-bg)',
      border: `1px solid ${borderColor}`,
      borderRadius: 'var(--radius-md)',
      outline: 'none',
      resize: 'vertical',
      boxShadow: focus && !invalid ? 'var(--focus-ring)' : 'none',
      transition: 'border-color var(--duration-fast) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard)'
    }
  }, rest)), invalid && errorText ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--type-caption-size)',
      color: 'var(--color-error)'
    }
  }, errorText) : helperText ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--type-caption-size)',
      color: 'var(--text-secondary)'
    }
  }, helperText) : null);
}
Object.assign(__ds_scope, { TextArea });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/TextArea.jsx", error: String((e && e.message) || e) }); }

// components/forms/TextInput.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Platforms Code — TextInput
 * Labelled text field with helper / error states. RTL-aware.
 */
function TextInput({
  label,
  value,
  onChange,
  placeholder = '',
  helperText = '',
  invalid = false,
  errorText = '',
  disabled = false,
  required = false,
  type = 'text',
  size = 'md',
  iconLeft = null,
  id,
  style = {},
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const heights = {
    sm: 'var(--control-height-sm)',
    md: 'var(--control-height-md)',
    lg: 'var(--control-height-lg)'
  };
  const reactId = React.useId();
  const fieldId = id || reactId;
  const borderColor = invalid ? 'var(--color-error)' : focus ? 'var(--border-focus)' : 'var(--field-border)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      fontFamily: 'var(--font-sans)',
      width: '100%',
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: fieldId,
    style: {
      fontSize: 'var(--type-label-size)',
      fontWeight: 'var(--weight-medium)',
      color: 'var(--text-strong)'
    }
  }, label, required && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--color-error)',
      marginInlineStart: '4px'
    }
  }, "*")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center'
    }
  }, iconLeft && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      insetInlineStart: '12px',
      display: 'flex',
      color: 'var(--text-secondary)',
      pointerEvents: 'none'
    }
  }, iconLeft), /*#__PURE__*/React.createElement("input", _extends({
    id: fieldId,
    type: type,
    value: value,
    onChange: onChange,
    placeholder: placeholder,
    disabled: disabled,
    "aria-invalid": invalid,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      width: '100%',
      height: heights[size],
      padding: iconLeft ? '0 14px 0 42px' : '0 14px',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--size-16)',
      color: 'var(--text-strong)',
      background: disabled ? 'var(--surface-subtle)' : 'var(--field-bg)',
      border: `1px solid ${borderColor}`,
      borderRadius: 'var(--radius-md)',
      outline: 'none',
      boxShadow: focus && !invalid ? 'var(--focus-ring)' : 'none',
      cursor: disabled ? 'not-allowed' : 'text',
      transition: 'border-color var(--duration-fast) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard)'
    }
  }, rest))), invalid && errorText ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--type-caption-size)',
      color: 'var(--color-error)'
    }
  }, errorText) : helperText ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--type-caption-size)',
      color: 'var(--text-secondary)'
    }
  }, helperText) : null);
}
Object.assign(__ds_scope, { TextInput });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/TextInput.jsx", error: String((e && e.message) || e) }); }

// components/general/Icon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Platforms Code — Icon
 * Thin wrapper over Material Symbols Rounded (the icon set used by the
 * reference Platforms Code web implementation). Pass the ligature name.
 */
function Icon({
  name,
  size = 20,
  weight = 400,
  fill = false,
  color = 'currentColor',
  style = {},
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    className: "material-symbols-rounded",
    "aria-hidden": "true",
    style: {
      fontSize: typeof size === 'number' ? `${size}px` : size,
      color,
      fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' ${typeof size === 'number' ? size : 24}`,
      flexShrink: 0,
      ...style
    }
  }, rest), name);
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/general/Icon.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Breadcrumb.jsx
try { (() => {
/**
 * Platforms Code — Breadcrumb
 * Hierarchical trail. RTL-aware separators (chevron flips with dir).
 */
function Breadcrumb({
  items = [],
  style = {}
}) {
  return /*#__PURE__*/React.createElement("nav", {
    "aria-label": "Breadcrumb",
    style: {
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("ol", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: '4px',
      listStyle: 'none',
      margin: 0,
      padding: 0
    }
  }, items.map((item, i) => {
    const last = i === items.length - 1;
    return /*#__PURE__*/React.createElement("li", {
      key: i,
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px'
      }
    }, last ? /*#__PURE__*/React.createElement("span", {
      "aria-current": "page",
      style: {
        fontSize: 'var(--size-14)',
        fontWeight: 'var(--weight-medium)',
        color: 'var(--text-strong)'
      }
    }, item.label) : /*#__PURE__*/React.createElement("a", {
      href: item.href || '#',
      onClick: item.onClick,
      style: {
        fontSize: 'var(--size-14)',
        color: 'var(--text-link)',
        textDecoration: 'none'
      }
    }, item.label), !last && /*#__PURE__*/React.createElement("span", {
      className: "material-symbols-rounded",
      "aria-hidden": "true",
      style: {
        fontSize: '18px',
        color: 'var(--text-disabled)'
      }
    }, "chevron_right"));
  })));
}
Object.assign(__ds_scope, { Breadcrumb });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Breadcrumb.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Pagination.jsx
try { (() => {
/**
 * Platforms Code — Pagination
 * Page selector with prev/next and a windowed page list.
 */
function Pagination({
  page = 1,
  totalPages = 1,
  onChange,
  style = {}
}) {
  const go = p => {
    if (p >= 1 && p <= totalPages && p !== page && onChange) onChange(p);
  };
  const pages = React.useMemo(() => {
    const out = [];
    const add = p => out.push(p);
    add(1);
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    if (start > 2) out.push('…');
    for (let p = start; p <= end; p++) add(p);
    if (end < totalPages - 1) out.push('…');
    if (totalPages > 1) add(totalPages);
    return out;
  }, [page, totalPages]);
  const arrow = (name, target, label, disabled) => /*#__PURE__*/React.createElement("button", {
    onClick: () => go(target),
    disabled: disabled,
    "aria-label": label,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '40px',
      height: '40px',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border-default)',
      background: 'var(--surface-card)',
      color: disabled ? 'var(--text-disabled)' : 'var(--text-body)',
      cursor: disabled ? 'not-allowed' : 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-rounded",
    style: {
      fontSize: '20px'
    }
  }, name));
  return /*#__PURE__*/React.createElement("nav", {
    "aria-label": "Pagination",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, arrow('chevron_left', page - 1, 'Previous page', page <= 1), pages.map((p, i) => p === '…' ? /*#__PURE__*/React.createElement("span", {
    key: `e${i}`,
    style: {
      width: '40px',
      textAlign: 'center',
      color: 'var(--text-disabled)'
    }
  }, "\u2026") : /*#__PURE__*/React.createElement("button", {
    key: p,
    onClick: () => go(p),
    "aria-current": p === page ? 'page' : undefined,
    style: {
      minWidth: '40px',
      height: '40px',
      padding: '0 8px',
      borderRadius: 'var(--radius-md)',
      border: `1px solid ${p === page ? 'var(--color-primary)' : 'var(--border-default)'}`,
      background: p === page ? 'var(--color-primary)' : 'var(--surface-card)',
      color: p === page ? 'var(--color-on-primary)' : 'var(--text-body)',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--size-14)',
      fontWeight: p === page ? 'var(--weight-semibold)' : 'var(--weight-regular)',
      cursor: 'pointer'
    }
  }, p)), arrow('chevron_right', page + 1, 'Next page', page >= totalPages));
}
Object.assign(__ds_scope, { Pagination });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Pagination.jsx", error: String((e && e.message) || e) }); }

// components/navigation/ProgressIndicator.jsx
try { (() => {
/**
 * Platforms Code — ProgressIndicator (Steps)
 * Horizontal or vertical multi-step progress for forms / wizards.
 */
function ProgressIndicator({
  steps = [],
  current = 0,
  direction = 'horizontal',
  style = {}
}) {
  const horizontal = direction === 'horizontal';
  return /*#__PURE__*/React.createElement("ol", {
    style: {
      display: 'flex',
      flexDirection: horizontal ? 'row' : 'column',
      listStyle: 'none',
      margin: 0,
      padding: 0,
      fontFamily: 'var(--font-sans)',
      gap: horizontal ? 0 : '4px',
      ...style
    }
  }, steps.map((label, i) => {
    const complete = i < current;
    const active = i === current;
    const color = complete || active ? 'var(--color-primary)' : 'var(--border-strong)';
    const last = i === steps.length - 1;
    return /*#__PURE__*/React.createElement("li", {
      key: i,
      style: {
        display: 'flex',
        flexDirection: horizontal ? 'column' : 'row',
        alignItems: horizontal ? 'flex-start' : 'flex-start',
        flex: horizontal ? 1 : 'none',
        gap: horizontal ? '8px' : '12px',
        position: 'relative'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: horizontal ? 'row' : 'column',
        alignItems: 'center',
        gap: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '28px',
        height: '28px',
        flexShrink: 0,
        borderRadius: 'var(--radius-full)',
        border: `2px solid ${color}`,
        background: complete ? 'var(--color-primary)' : 'var(--surface-card)',
        color: complete ? 'var(--neutral-0)' : active ? 'var(--color-primary)' : 'var(--text-disabled)',
        fontSize: 'var(--size-14)',
        fontWeight: 'var(--weight-semibold)'
      }
    }, complete ? /*#__PURE__*/React.createElement("span", {
      className: "material-symbols-rounded",
      style: {
        fontSize: '18px'
      }
    }, "check") : i + 1), !last && /*#__PURE__*/React.createElement("span", {
      style: {
        background: complete ? 'var(--color-primary)' : 'var(--border-subtle)',
        ...(horizontal ? {
          height: '2px',
          flex: 1,
          minWidth: '24px'
        } : {
          width: '2px',
          minHeight: '28px',
          marginInlineStart: '13px'
        })
      }
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 'var(--size-14)',
        fontWeight: active ? 'var(--weight-semibold)' : 'var(--weight-regular)',
        color: active || complete ? 'var(--text-strong)' : 'var(--text-secondary)',
        paddingInlineEnd: horizontal ? '8px' : 0,
        paddingBottom: horizontal ? 0 : '8px'
      }
    }, label));
  }));
}
Object.assign(__ds_scope, { ProgressIndicator });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/ProgressIndicator.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
/**
 * Platforms Code — Tabs
 * Underline tab bar. Controlled via activeId; green active indicator.
 */
function Tabs({
  tabs = [],
  activeId,
  onChange,
  style = {}
}) {
  const normalized = tabs.map(t => typeof t === 'string' ? {
    id: t,
    label: t
  } : t);
  const current = activeId ?? normalized[0]?.id;
  return /*#__PURE__*/React.createElement("div", {
    role: "tablist",
    style: {
      display: 'flex',
      gap: '4px',
      borderBottom: '1px solid var(--border-subtle)',
      fontFamily: 'var(--font-sans)',
      overflowX: 'auto',
      ...style
    }
  }, normalized.map(t => {
    const active = t.id === current;
    return /*#__PURE__*/React.createElement("button", {
      key: t.id,
      role: "tab",
      "aria-selected": active,
      onClick: () => onChange && onChange(t.id),
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 16px',
        background: 'none',
        border: 'none',
        borderBottom: `2px solid ${active ? 'var(--color-primary)' : 'transparent'}`,
        marginBottom: '-1px',
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--size-16)',
        fontWeight: active ? 'var(--weight-semibold)' : 'var(--weight-regular)',
        color: active ? 'var(--text-strong)' : 'var(--text-secondary)',
        whiteSpace: 'nowrap',
        transition: 'color var(--duration-fast) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard)'
      }
    }, t.icon && /*#__PURE__*/React.createElement("span", {
      className: "material-symbols-rounded",
      style: {
        fontSize: '20px'
      }
    }, t.icon), t.label, t.count != null && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 'var(--size-12)',
        fontWeight: 'var(--weight-medium)',
        background: 'var(--surface-subtle)',
        color: 'var(--text-secondary)',
        borderRadius: 'var(--radius-full)',
        padding: '1px 8px'
      }
    }, t.count));
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// ui_kits/gov-portal/ApplyScreen.jsx
try { (() => {
/* Platforms Code UI kit — multi-step application form */
const {
  Icon: AIcon,
  Card: ACard,
  TextInput: AInput,
  Select: ASelect,
  TextArea: ATextArea,
  Checkbox: ACheckbox,
  RadioGroup: ARadio,
  Button: AButton,
  Breadcrumb: ABreadcrumb,
  ProgressIndicator: AProgress,
  InlineAlert: AAlert
} = window.PlatformsCodeDesignSystem_fb260e;
function ApplyScreen({
  serviceId,
  onNavigate,
  onDone
}) {
  const data = window.PORTAL_DATA;
  const s = data.services.find(x => x.id === serviceId) || data.services[0];
  const steps = ['Eligibility', 'Your details', 'Documents', 'Review'];
  const [step, setStep] = React.useState(0);
  const [confirmEligible, setConfirmEligible] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const next = () => setStep(s => Math.min(s + 1, steps.length - 1));
  const back = () => setStep(s => Math.max(s - 1, 0));
  if (submitted) {
    return /*#__PURE__*/React.createElement("main", {
      style: {
        fontFamily: 'var(--font-sans)',
        maxWidth: '640px',
        margin: '0 auto',
        padding: '64px 24px',
        textAlign: 'center'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: '72px',
        height: '72px',
        margin: '0 auto 20px',
        borderRadius: 'var(--radius-full)',
        background: 'var(--color-success-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }, /*#__PURE__*/React.createElement(AIcon, {
      name: "check_circle",
      size: 44,
      fill: true,
      color: "var(--color-success)"
    })), /*#__PURE__*/React.createElement("h1", {
      style: {
        margin: '0 0 12px',
        fontSize: '30px',
        fontWeight: 700,
        color: 'var(--text-strong)'
      }
    }, "Request submitted"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: '0 0 8px',
        fontSize: '17px',
        color: 'var(--text-body)'
      }
    }, "Your request for ", /*#__PURE__*/React.createElement("b", null, s.title), " has been received."), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: '0 0 28px',
        fontSize: '15px',
        color: 'var(--text-secondary)',
        fontFamily: 'var(--font-mono)'
      }
    }, "Reference: REF-1029-4471"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: '12px',
        justifyContent: 'center'
      }
    }, /*#__PURE__*/React.createElement(AButton, {
      variant: "secondary",
      onClick: () => onNavigate('home')
    }, "Back to home"), /*#__PURE__*/React.createElement(AButton, {
      onClick: () => onNavigate('services')
    }, "Browse more services")));
  }
  return /*#__PURE__*/React.createElement("main", {
    style: {
      fontFamily: 'var(--font-sans)',
      maxWidth: '760px',
      margin: '0 auto',
      padding: '24px 24px 0'
    }
  }, /*#__PURE__*/React.createElement(ABreadcrumb, {
    items: [{
      label: 'Home',
      onClick: () => onNavigate('home')
    }, {
      label: 'Services',
      onClick: () => onNavigate('services')
    }, {
      label: s.title,
      onClick: () => onDone(serviceId)
    }, {
      label: 'Apply'
    }]
  }), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: '16px 0 28px',
      fontSize: '28px',
      fontWeight: 700,
      color: 'var(--text-strong)'
    }
  }, s.title), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '32px'
    }
  }, /*#__PURE__*/React.createElement(AProgress, {
    current: step,
    steps: steps
  })), /*#__PURE__*/React.createElement(ACard, {
    padding: "lg"
  }, step === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '18px'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontSize: '20px',
      fontWeight: 600,
      color: 'var(--text-strong)'
    }
  }, "Confirm your eligibility"), /*#__PURE__*/React.createElement(AAlert, {
    kind: "info",
    title: "Before you begin"
  }, "You will need a valid national ID and a recent proof of address."), /*#__PURE__*/React.createElement(ARadio, {
    legend: "Are you applying for yourself or on behalf of another person?",
    defaultValue: "self",
    options: [{
      value: 'self',
      label: 'Myself'
    }, {
      value: 'other',
      label: 'On behalf of another person'
    }],
    onChange: () => {},
    value: "self"
  }), /*#__PURE__*/React.createElement(ACheckbox, {
    label: "I confirm the information I provide is accurate.",
    checked: confirmEligible,
    onChange: e => setConfirmEligible(e.target.checked)
  })), step === 1 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '18px'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontSize: '20px',
      fontWeight: 600,
      color: 'var(--text-strong)'
    }
  }, "Your details"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '16px'
    }
  }, /*#__PURE__*/React.createElement(AInput, {
    label: "Full name",
    defaultValue: "Fatimah Al-Saud"
  }), /*#__PURE__*/React.createElement(AInput, {
    label: "National ID",
    defaultValue: "10\u2022\u2022\u2022\u2022\u2022\u2022\u20222",
    iconLeft: /*#__PURE__*/React.createElement(AIcon, {
      name: "badge",
      size: 18
    })
  }), /*#__PURE__*/React.createElement(AInput, {
    label: "Mobile number",
    placeholder: "05xxxxxxxx"
  }), /*#__PURE__*/React.createElement(ASelect, {
    label: "Region",
    placeholder: "Choose a region",
    options: ["Riyadh", "Makkah", "Eastern Province"]
  })), /*#__PURE__*/React.createElement(ATextArea, {
    label: "Additional notes (optional)",
    rows: 3,
    placeholder: "Anything we should know?"
  })), step === 2 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '18px'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontSize: '20px',
      fontWeight: 600,
      color: 'var(--text-strong)'
    }
  }, "Upload documents"), ['National ID copy', 'Proof of address'].map(d => /*#__PURE__*/React.createElement("div", {
    key: d,
    style: {
      border: '1.5px dashed var(--border-default)',
      borderRadius: 'var(--radius-md)',
      padding: '20px',
      display: 'flex',
      alignItems: 'center',
      gap: '14px'
    }
  }, /*#__PURE__*/React.createElement(AIcon, {
    name: "upload_file",
    size: 28,
    color: "var(--color-primary)"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '15px',
      fontWeight: 600,
      color: 'var(--text-strong)'
    }
  }, d), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '13px',
      color: 'var(--text-secondary)'
    }
  }, "PDF or JPG, up to 5 MB")), /*#__PURE__*/React.createElement(AButton, {
    variant: "secondary",
    size: "sm"
  }, "Browse")))), step === 3 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '18px'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontSize: '20px',
      fontWeight: 600,
      color: 'var(--text-strong)'
    }
  }, "Review & pay"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    }
  }, [['Service', s.title], ['Applicant', 'Fatimah Al-Saud'], ['National ID', '10•••••••2'], ['Service fee', s.fee]].map(([l, v]) => /*#__PURE__*/React.createElement("div", {
    key: l,
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '12px 0',
      borderBottom: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '14px',
      color: 'var(--text-secondary)'
    }
  }, l), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '14px',
      fontWeight: 600,
      color: 'var(--text-strong)'
    }
  }, v)))), /*#__PURE__*/React.createElement(AAlert, {
    kind: "warning"
  }, "Payment of ", s.fee, " will be collected via SADAD on submission.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      marginTop: '28px',
      paddingTop: '20px',
      borderTop: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement(AButton, {
    variant: "secondary",
    onClick: step === 0 ? () => onDone(serviceId) : back,
    iconLeft: /*#__PURE__*/React.createElement(AIcon, {
      name: "arrow_back",
      size: 18
    })
  }, step === 0 ? 'Cancel' : 'Back'), step < steps.length - 1 ? /*#__PURE__*/React.createElement(AButton, {
    onClick: next,
    disabled: step === 0 && !confirmEligible,
    iconRight: /*#__PURE__*/React.createElement(AIcon, {
      name: "arrow_forward",
      size: 18
    })
  }, "Continue") : /*#__PURE__*/React.createElement(AButton, {
    onClick: () => setSubmitted(true),
    iconRight: /*#__PURE__*/React.createElement(AIcon, {
      name: "check",
      size: 18
    })
  }, "Submit & pay"))));
}
Object.assign(window, {
  ApplyScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/gov-portal/ApplyScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/gov-portal/Chrome.jsx
try { (() => {
/* Platforms Code UI kit — portal header + footer (shared chrome) */
const {
  Button,
  Icon,
  Avatar
} = window.PlatformsCodeDesignSystem_fb260e;
function Logo({
  reversed
}) {
  const fg = reversed ? '#fff' : 'var(--text-strong)';
  const en = reversed ? 'var(--green-10)' : 'var(--color-primary)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '38px',
      height: '38px',
      borderRadius: 'var(--radius-md)',
      background: reversed ? '#fff' : 'var(--color-primary)',
      color: reversed ? 'var(--color-primary)' : '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 700,
      fontSize: '17px'
    }
  }, "\u0643\u0648\u062F"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      lineHeight: 1.15
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '17px',
      fontWeight: 700,
      color: fg
    }
  }, "\u0645\u0646\u0635\u0627\u062A \u0643\u0648\u062F"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '10px',
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      color: en
    }
  }, "Platforms Code")));
}
function PortalHeader({
  active,
  onNavigate,
  loggedIn,
  onLogin
}) {
  const nav = [{
    id: 'home',
    label: 'Home'
  }, {
    id: 'services',
    label: 'Services'
  }, {
    id: 'agencies',
    label: 'Agencies'
  }, {
    id: 'support',
    label: 'Support'
  }];
  return /*#__PURE__*/React.createElement("header", {
    style: {
      position: 'sticky',
      top: 0,
      zIndex: 1100,
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--green-90)',
      color: 'var(--green-10)',
      fontSize: '12px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '7px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "lock",
    size: 14,
    color: "var(--green-10)"
  }), " An official platform of the Government of Saudi Arabia"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {},
    style: {
      background: 'none',
      border: 'none',
      color: '#fff',
      fontFamily: 'var(--font-sans)',
      fontSize: '12px',
      fontWeight: 600,
      cursor: 'pointer'
    }
  }, "\u0627\u0644\u0639\u0631\u0628\u064A\u0629"))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface-card)',
      borderBottom: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '14px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '24px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      cursor: 'pointer'
    },
    onClick: () => onNavigate('home')
  }, /*#__PURE__*/React.createElement(Logo, null)), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      gap: '4px',
      flex: 1,
      justifyContent: 'center'
    }
  }, nav.map(n => /*#__PURE__*/React.createElement("button", {
    key: n.id,
    onClick: () => onNavigate(n.id),
    style: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: '8px 14px',
      borderRadius: 'var(--radius-md)',
      fontFamily: 'var(--font-sans)',
      fontSize: '15px',
      fontWeight: active === n.id ? 600 : 500,
      color: active === n.id ? 'var(--color-primary)' : 'var(--text-body)'
    }
  }, n.label))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    }
  }, /*#__PURE__*/React.createElement("button", {
    "aria-label": "Search",
    style: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      display: 'flex',
      color: 'var(--text-body)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 22
  })), loggedIn ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: "Fatimah A",
    size: "sm"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '14px',
      fontWeight: 600,
      color: 'var(--text-strong)'
    }
  }, "Fatimah")) : /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "sm",
    iconLeft: /*#__PURE__*/React.createElement(Icon, {
      name: "account_circle",
      size: 18
    }),
    onClick: onLogin
  }, "Sign in \xB7 Nafath")))));
}
function PortalFooter() {
  const cols = [{
    h: 'Services',
    links: ['Identity & Passports', 'Vehicles', 'Business', 'Health']
  }, {
    h: 'About',
    links: ['About the platform', 'Open data', 'Accessibility', 'Privacy policy']
  }, {
    h: 'Support',
    links: ['Help centre', 'Contact us', 'Report an issue', 'FAQ']
  }];
  return /*#__PURE__*/React.createElement("footer", {
    style: {
      background: 'var(--green-100)',
      color: 'var(--green-10)',
      fontFamily: 'var(--font-sans)',
      marginTop: '64px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '48px 24px 28px',
      display: 'grid',
      gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
      gap: '32px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '14px'
    }
  }, /*#__PURE__*/React.createElement(Logo, {
    reversed: true
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: '13px',
      lineHeight: 1.6,
      color: 'rgba(255,255,255,0.7)'
    }
  }, "The unified reference for designing and developing government platform interfaces in the Kingdom.")), cols.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.h
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '13px',
      fontWeight: 600,
      marginBottom: '14px',
      color: '#fff'
    }
  }, c.h), /*#__PURE__*/React.createElement("ul", {
    style: {
      listStyle: 'none',
      margin: 0,
      padding: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    }
  }, c.links.map(l => /*#__PURE__*/React.createElement("li", {
    key: l
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      fontSize: '13px',
      color: 'rgba(255,255,255,0.7)',
      textDecoration: 'none'
    }
  }, l))))))), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid rgba(255,255,255,0.12)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '16px 24px',
      display: 'flex',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '8px',
      fontSize: '12px',
      color: 'rgba(255,255,255,0.6)'
    }
  }, /*#__PURE__*/React.createElement("span", null, "\xA9 2026 Digital Government Authority"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "verified",
    size: 14,
    fill: true,
    color: "var(--green-30)"
  }), " All government sites end with .gov.sa"))));
}
Object.assign(window, {
  PortalHeader,
  PortalFooter,
  Logo
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/gov-portal/Chrome.jsx", error: String((e && e.message) || e) }); }

// ui_kits/gov-portal/HomeScreen.jsx
try { (() => {
/* Platforms Code UI kit — Home screen */
const {
  Button: HButton,
  Icon: HIcon,
  Card: HCard,
  TextInput: HInput,
  Tag: HTag
} = window.PlatformsCodeDesignSystem_fb260e;
function HomeScreen({
  onNavigate,
  onOpenService
}) {
  const data = window.PORTAL_DATA;
  const [q, setQ] = React.useState('');
  const popular = data.popular.map(id => data.services.find(s => s.id === id));
  return /*#__PURE__*/React.createElement("main", {
    style: {
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("section", {
    style: {
      background: 'linear-gradient(180deg, var(--green-90) 0%, var(--green-100) 100%)',
      color: '#fff'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '72px 24px 84px',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-block',
      fontSize: '13px',
      fontWeight: 600,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      color: 'var(--green-30)',
      marginBottom: '16px'
    }
  }, "Government of Saudi Arabia"), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: '0 auto 16px',
      maxWidth: '760px',
      fontSize: '46px',
      lineHeight: 1.15,
      fontWeight: 700,
      letterSpacing: '-0.02em'
    }
  }, "Every government service, in one place"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '0 auto 32px',
      maxWidth: '560px',
      fontSize: '18px',
      lineHeight: 1.6,
      color: 'rgba(255,255,255,0.8)'
    }
  }, "Apply for, track and complete more than 3,000 digital services from a single trusted platform."), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: '620px',
      margin: '0 auto',
      display: 'flex',
      gap: '10px',
      background: '#fff',
      padding: '8px',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-lg)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(HInput, {
    placeholder: "Search services \u2014 e.g. renew ID, passport, vehicle",
    value: q,
    onChange: e => setQ(e.target.value),
    iconLeft: /*#__PURE__*/React.createElement(HIcon, {
      name: "search",
      size: 20
    }),
    size: "lg"
  })), /*#__PURE__*/React.createElement(HButton, {
    size: "lg",
    onClick: () => onNavigate('services')
  }, "Search")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: '18px',
      display: 'flex',
      gap: '8px',
      justifyContent: 'center',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '13px',
      color: 'rgba(255,255,255,0.65)'
    }
  }, "Popular:"), ['Renew ID', 'Vehicle registration', 'Health appointment'].map(t => /*#__PURE__*/React.createElement("button", {
    key: t,
    onClick: () => onNavigate('services'),
    style: {
      background: 'rgba(255,255,255,0.12)',
      border: 'none',
      color: '#fff',
      fontFamily: 'var(--font-sans)',
      fontSize: '13px',
      padding: '4px 12px',
      borderRadius: 'var(--radius-full)',
      cursor: 'pointer'
    }
  }, t))))), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '0 24px'
    }
  }, /*#__PURE__*/React.createElement("section", {
    style: {
      marginTop: '-48px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: '16px'
    }
  }, data.categories.map(c => /*#__PURE__*/React.createElement(HCard, {
    key: c.id,
    interactive: true,
    onClick: () => onNavigate('services'),
    padding: "md"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '48px',
      height: '48px',
      borderRadius: 'var(--radius-md)',
      background: 'var(--green-10)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(HIcon, {
    name: c.icon,
    size: 26,
    color: "var(--color-primary)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '16px',
      fontWeight: 600,
      color: 'var(--text-strong)'
    }
  }, c.label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '13px',
      color: 'var(--text-secondary)'
    }
  }, c.count, " services")))))), /*#__PURE__*/React.createElement("section", {
    style: {
      marginTop: '56px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginBottom: '20px'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontSize: '28px',
      fontWeight: 700,
      color: 'var(--text-strong)'
    }
  }, "Most used services"), /*#__PURE__*/React.createElement("button", {
    onClick: () => onNavigate('services'),
    style: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: 'var(--color-primary)',
      fontFamily: 'var(--font-sans)',
      fontWeight: 600,
      fontSize: '15px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px'
    }
  }, "View all ", /*#__PURE__*/React.createElement(HIcon, {
    name: "chevron_right",
    size: 18
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '16px'
    }
  }, popular.map(s => /*#__PURE__*/React.createElement(HCard, {
    key: s.id,
    interactive: true,
    onClick: () => onOpenService(s.id)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '16px',
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '44px',
      height: '44px',
      flexShrink: 0,
      borderRadius: 'var(--radius-md)',
      background: 'var(--green-10)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(HIcon, {
    name: data.categories.find(c => c.id === s.cat)?.icon,
    size: 24,
    color: "var(--color-primary)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '4px'
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      fontSize: '17px',
      fontWeight: 600,
      color: 'var(--text-strong)'
    }
  }, s.title), /*#__PURE__*/React.createElement(HTag, {
    tone: s.status === 'available' ? 'success' : 'warning',
    size: "sm"
  }, s.status === 'available' ? 'Available' : 'Appointment')), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '0 0 10px',
      fontSize: '14px',
      color: 'var(--text-body)',
      lineHeight: 1.5
    }
  }, s.desc), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '16px',
      fontSize: '13px',
      color: 'var(--text-secondary)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px'
    }
  }, /*#__PURE__*/React.createElement(HIcon, {
    name: "schedule",
    size: 16
  }), " ", s.time), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px'
    }
  }, /*#__PURE__*/React.createElement(HIcon, {
    name: "payments",
    size: 16
  }), " ", s.fee)))))))), /*#__PURE__*/React.createElement("section", {
    style: {
      marginTop: '56px',
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      padding: '32px',
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: '24px',
      textAlign: 'center'
    }
  }, [['3,200+', 'Digital services'], ['180', 'Government agencies'], ['98%', 'Satisfaction rate'], ['24/7', 'Always available']].map(([n, l]) => /*#__PURE__*/React.createElement("div", {
    key: l
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '34px',
      fontWeight: 700,
      color: 'var(--color-primary)'
    }
  }, n), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '14px',
      color: 'var(--text-secondary)',
      marginTop: '4px'
    }
  }, l))))));
}
Object.assign(window, {
  HomeScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/gov-portal/HomeScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/gov-portal/LoginModal.jsx
try { (() => {
/* Platforms Code UI kit — Nafath sign-in modal */
const {
  Modal: LModal,
  TextInput: LInput,
  Button: LButton,
  Icon: LIcon,
  InlineAlert: LAlert
} = window.PlatformsCodeDesignSystem_fb260e;
function LoginModal({
  open,
  onClose,
  onSuccess
}) {
  const [stage, setStage] = React.useState('id'); // id -> verify
  const [number, setNumber] = React.useState(null);
  React.useEffect(() => {
    if (open) {
      setStage('id');
      setNumber(null);
    }
  }, [open]);
  const startVerify = () => {
    setNumber(Math.floor(10 + Math.random() * 80));
    setStage('verify');
  };
  return /*#__PURE__*/React.createElement(LModal, {
    open: open,
    onClose: onClose,
    title: "Sign in with Nafath",
    size: "sm"
  }, stage === 'id' ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '18px'
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: '15px',
      color: 'var(--text-body)',
      lineHeight: 1.6
    }
  }, "Enter your national ID. We'll send a verification request to your Nafath app."), /*#__PURE__*/React.createElement(LInput, {
    label: "National ID / Iqama",
    placeholder: "10xxxxxxxx",
    iconLeft: /*#__PURE__*/React.createElement(LIcon, {
      name: "badge",
      size: 18
    }),
    defaultValue: "1012345672"
  }), /*#__PURE__*/React.createElement(LButton, {
    fullWidth: true,
    size: "lg",
    onClick: startVerify,
    iconRight: /*#__PURE__*/React.createElement(LIcon, {
      name: "arrow_forward",
      size: 20
    })
  }, "Continue"), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      fontSize: '13px',
      color: 'var(--text-secondary)'
    }
  }, "Don't have Nafath? ", /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      color: 'var(--text-link)',
      fontWeight: 600
    }
  }, "Learn more"))) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement(LAlert, {
    kind: "info"
  }, "Open the Nafath app and select the number below."), /*#__PURE__*/React.createElement("div", {
    style: {
      width: '96px',
      height: '96px',
      margin: '0 auto',
      borderRadius: 'var(--radius-lg)',
      background: 'var(--color-primary)',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '44px',
      fontWeight: 700
    }
  }, number), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: '14px',
      color: 'var(--text-secondary)'
    }
  }, "Waiting for confirmation\u2026"), /*#__PURE__*/React.createElement(LButton, {
    fullWidth: true,
    size: "lg",
    onClick: onSuccess
  }, "I've confirmed in the app")));
}
Object.assign(window, {
  LoginModal
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/gov-portal/LoginModal.jsx", error: String((e && e.message) || e) }); }

// ui_kits/gov-portal/ServiceDetailScreen.jsx
try { (() => {
/* Platforms Code UI kit — Service detail screen */
const {
  Icon: DIcon,
  Card: DCard,
  Tag: DTag,
  Breadcrumb: DBreadcrumb,
  Tabs: DTabs,
  Accordion: DAccordion,
  Button: DButton,
  InlineAlert: DAlert
} = window.PlatformsCodeDesignSystem_fb260e;
function ServiceDetailScreen({
  serviceId,
  onNavigate,
  onApply,
  loggedIn
}) {
  const data = window.PORTAL_DATA;
  const s = data.services.find(x => x.id === serviceId) || data.services[0];
  const cat = data.categories.find(c => c.id === s.cat);
  const [tab, setTab] = React.useState('overview');
  return /*#__PURE__*/React.createElement("main", {
    style: {
      fontFamily: 'var(--font-sans)',
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '24px 24px 0'
    }
  }, /*#__PURE__*/React.createElement(DBreadcrumb, {
    items: [{
      label: 'Home',
      onClick: () => onNavigate('home')
    }, {
      label: 'Services',
      onClick: () => onNavigate('services')
    }, {
      label: s.title
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 320px',
      gap: '40px',
      alignItems: 'start',
      marginTop: '16px'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
      marginBottom: '8px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '52px',
      height: '52px',
      borderRadius: 'var(--radius-md)',
      background: 'var(--green-10)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(DIcon, {
    name: cat?.icon,
    size: 28,
    color: "var(--color-primary)"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: '30px',
      fontWeight: 700,
      color: 'var(--text-strong)'
    }
  }, s.title), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '14px',
      color: 'var(--text-secondary)'
    }
  }, s.agency))), /*#__PURE__*/React.createElement("div", {
    style: {
      margin: '24px 0'
    }
  }, /*#__PURE__*/React.createElement(DTabs, {
    activeId: tab,
    onChange: setTab,
    tabs: [{
      id: 'overview',
      label: 'Overview'
    }, {
      id: 'reqs',
      label: 'Requirements',
      count: 3
    }, {
      id: 'steps',
      label: 'How it works'
    }, {
      id: 'faq',
      label: 'FAQ'
    }]
  })), tab === 'overview' && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '16px',
      lineHeight: 1.7,
      color: 'var(--text-body)'
    }
  }, /*#__PURE__*/React.createElement("p", null, s.desc, " This service is delivered fully online and the outcome is issued digitally to your account. You can track its status at any time from your dashboard."), /*#__PURE__*/React.createElement("p", null, "Eligible applicants will receive a confirmation by SMS and email once the request is processed.")), tab === 'reqs' && /*#__PURE__*/React.createElement(DAccordion, {
    allowMultiple: true,
    defaultOpen: [0],
    items: [{
      title: 'Eligibility',
      content: 'You must be a Saudi citizen or resident over 18 with a valid national ID.'
    }, {
      title: 'Required documents',
      content: 'A valid national ID and a recent proof of address. Additional documents may be requested.'
    }, {
      title: 'Fees & payment',
      content: `A fee of ${s.fee} is payable online via SADAD at the final step.`
    }]
  }), tab === 'steps' && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '16px',
      lineHeight: 1.7,
      color: 'var(--text-body)'
    }
  }, /*#__PURE__*/React.createElement("ol", {
    style: {
      paddingInlineStart: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    }
  }, /*#__PURE__*/React.createElement("li", null, "Verify your identity through Nafath."), /*#__PURE__*/React.createElement("li", null, "Review your details and confirm eligibility."), /*#__PURE__*/React.createElement("li", null, "Upload any required documents."), /*#__PURE__*/React.createElement("li", null, "Pay the fee and submit your request."))), tab === 'faq' && /*#__PURE__*/React.createElement(DAccordion, {
    items: [{
      title: 'How long does processing take?',
      content: 'Most requests are processed within 1–3 business days.'
    }, {
      title: 'Can I cancel after submitting?',
      content: 'Submitted requests cannot be edited, but can be cancelled before processing begins.'
    }]
  })), /*#__PURE__*/React.createElement(DCard, {
    style: {
      position: 'sticky',
      top: '120px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    }
  }, /*#__PURE__*/React.createElement(DTag, {
    tone: s.status === 'available' ? 'success' : 'warning',
    iconLeft: /*#__PURE__*/React.createElement(DIcon, {
      name: s.status === 'available' ? 'check_circle' : 'event',
      size: 14,
      fill: true
    })
  }, s.status === 'available' ? 'Available online' : 'Appointment required'), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }
  }, [['schedule', 'Estimated time', s.time], ['payments', 'Service fee', s.fee], ['language', 'Channel', 'Online']].map(([ic, l, v]) => /*#__PURE__*/React.createElement("div", {
    key: l,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px'
    }
  }, /*#__PURE__*/React.createElement(DIcon, {
    name: ic,
    size: 20,
    color: "var(--text-secondary)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      fontSize: '14px',
      color: 'var(--text-secondary)'
    }
  }, l), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '14px',
      fontWeight: 600,
      color: 'var(--text-strong)'
    }
  }, v)))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: '1px',
      background: 'var(--border-subtle)'
    }
  }), !loggedIn && /*#__PURE__*/React.createElement(DAlert, {
    kind: "info"
  }, "Sign in with Nafath to start this service."), /*#__PURE__*/React.createElement(DButton, {
    fullWidth: true,
    size: "lg",
    iconRight: /*#__PURE__*/React.createElement(DIcon, {
      name: "arrow_forward",
      size: 20
    }),
    onClick: onApply
  }, "Start service"), /*#__PURE__*/React.createElement(DButton, {
    fullWidth: true,
    variant: "secondary",
    iconLeft: /*#__PURE__*/React.createElement(DIcon, {
      name: "bookmark_border",
      size: 18
    })
  }, "Save for later")))));
}
Object.assign(window, {
  ServiceDetailScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/gov-portal/ServiceDetailScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/gov-portal/ServicesScreen.jsx
try { (() => {
/* Platforms Code UI kit — Services listing screen */
const {
  Icon: SIcon,
  Card: SCard,
  TextInput: SInput,
  Tag: STag,
  Breadcrumb: SBreadcrumb,
  Pagination: SPagination,
  Checkbox: SCheckbox,
  Button: SButton
} = window.PlatformsCodeDesignSystem_fb260e;
function ServicesScreen({
  onNavigate,
  onOpenService
}) {
  const data = window.PORTAL_DATA;
  const [q, setQ] = React.useState('');
  const [cats, setCats] = React.useState(new Set());
  const [page, setPage] = React.useState(1);
  const toggleCat = id => setCats(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const filtered = data.services.filter(s => (cats.size === 0 || cats.has(s.cat)) && (q === '' || s.title.toLowerCase().includes(q.toLowerCase())));
  return /*#__PURE__*/React.createElement("main", {
    style: {
      fontFamily: 'var(--font-sans)',
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '24px 24px 0'
    }
  }, /*#__PURE__*/React.createElement(SBreadcrumb, {
    items: [{
      label: 'Home',
      onClick: () => onNavigate('home')
    }, {
      label: 'Services'
    }]
  }), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: '16px 0 24px',
      fontSize: '32px',
      fontWeight: 700,
      color: 'var(--text-strong)'
    }
  }, "Services directory"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '260px 1fr',
      gap: '32px',
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement("aside", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      position: 'sticky',
      top: '120px'
    }
  }, /*#__PURE__*/React.createElement(SInput, {
    placeholder: "Filter services",
    value: q,
    onChange: e => setQ(e.target.value),
    iconLeft: /*#__PURE__*/React.createElement(SIcon, {
      name: "search",
      size: 18
    })
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '13px',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      color: 'var(--text-secondary)',
      marginBottom: '14px'
    }
  }, "Category"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }
  }, data.categories.map(c => /*#__PURE__*/React.createElement(SCheckbox, {
    key: c.id,
    label: c.label,
    checked: cats.has(c.id),
    onChange: () => toggleCat(c.id)
  }))))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '16px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '14px',
      color: 'var(--text-secondary)'
    }
  }, filtered.length, " services"), cats.size > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap'
    }
  }, [...cats].map(id => /*#__PURE__*/React.createElement(STag, {
    key: id,
    tone: "primary",
    size: "sm",
    onRemove: () => toggleCat(id)
  }, data.categories.find(c => c.id === id)?.label)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }
  }, filtered.map(s => /*#__PURE__*/React.createElement(SCard, {
    key: s.id,
    interactive: true,
    onClick: () => onOpenService(s.id)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '16px',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '48px',
      height: '48px',
      flexShrink: 0,
      borderRadius: 'var(--radius-md)',
      background: 'var(--green-10)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(SIcon, {
    name: data.categories.find(c => c.id === s.cat)?.icon,
    size: 26,
    color: "var(--color-primary)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      marginBottom: '2px'
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      fontSize: '17px',
      fontWeight: 600,
      color: 'var(--text-strong)'
    }
  }, s.title), /*#__PURE__*/React.createElement(STag, {
    tone: s.status === 'available' ? 'success' : 'warning',
    size: "sm"
  }, s.status === 'available' ? 'Available' : 'Appointment')), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '13px',
      color: 'var(--text-secondary)'
    }
  }, s.agency, " \xB7 ", s.time, " \xB7 ", s.fee)), /*#__PURE__*/React.createElement(SIcon, {
    name: "chevron_right",
    size: 24,
    color: "var(--text-disabled)"
  })))), filtered.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      padding: '48px',
      color: 'var(--text-secondary)'
    }
  }, /*#__PURE__*/React.createElement(SIcon, {
    name: "search_off",
    size: 40,
    color: "var(--text-disabled)"
  }), /*#__PURE__*/React.createElement("p", null, "No services match your filters."))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: '28px',
      display: 'flex',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(SPagination, {
    page: page,
    totalPages: 6,
    onChange: setPage
  })))));
}
Object.assign(window, {
  ServicesScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/gov-portal/ServicesScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/gov-portal/data.js
try { (() => {
/* Platforms Code — sample portal data (fictional, for the UI kit) */
window.PORTAL_DATA = {
  categories: [{
    id: 'id',
    icon: 'badge',
    label: 'Identity & Passports',
    count: 42
  }, {
    id: 'vehicles',
    icon: 'directions_car',
    label: 'Vehicles & Transport',
    count: 31
  }, {
    id: 'business',
    icon: 'storefront',
    label: 'Business & Commerce',
    count: 58
  }, {
    id: 'health',
    icon: 'health_and_safety',
    label: 'Health',
    count: 27
  }, {
    id: 'property',
    icon: 'home_work',
    label: 'Housing & Property',
    count: 19
  }, {
    id: 'justice',
    icon: 'gavel',
    label: 'Justice',
    count: 23
  }, {
    id: 'edu',
    icon: 'school',
    label: 'Education',
    count: 36
  }, {
    id: 'social',
    icon: 'diversity_3',
    label: 'Social Services',
    count: 44
  }],
  services: [{
    id: 's1',
    title: 'Renew national ID',
    cat: 'id',
    agency: 'Ministry of Interior',
    time: '10 min',
    fee: 'SAR 100',
    status: 'available',
    desc: 'Renew your national identity card before it expires.'
  }, {
    id: 's2',
    title: 'Renew vehicle registration',
    cat: 'vehicles',
    agency: 'Ministry of Interior',
    time: '3 min',
    fee: 'SAR 150',
    status: 'available',
    desc: 'Renew the registration (Istimara) for a private vehicle.'
  }, {
    id: 's3',
    title: 'Issue commercial registration',
    cat: 'business',
    agency: 'Ministry of Commerce',
    time: '15 min',
    fee: 'SAR 200',
    status: 'available',
    desc: 'Register a new commercial entity and obtain a CR number.'
  }, {
    id: 's4',
    title: 'Book a health appointment',
    cat: 'health',
    agency: 'Ministry of Health',
    time: '5 min',
    fee: 'Free',
    status: 'available',
    desc: 'Reserve a primary-care appointment at your assigned centre.'
  }, {
    id: 's5',
    title: 'Renew passport',
    cat: 'id',
    agency: 'Ministry of Interior',
    time: '10 min',
    fee: 'SAR 300',
    status: 'appointment',
    desc: 'Renew a Saudi passport — appointment required for collection.'
  }, {
    id: 's6',
    title: 'Transfer property title',
    cat: 'property',
    agency: 'Ministry of Justice',
    time: '20 min',
    fee: 'SAR 0',
    status: 'available',
    desc: 'Transfer ownership of a registered real-estate property.'
  }],
  popular: ['s1', 's2', 's4', 's5']
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/gov-portal/data.js", error: String((e && e.message) || e) }); }

export const Accordion = __ds_scope.Accordion;
export const Avatar = __ds_scope.Avatar;
export const Card = __ds_scope.Card;
export const CardHeader = __ds_scope.CardHeader;
export const CardTitle = __ds_scope.CardTitle;
export const CardBody = __ds_scope.CardBody;
export const InlineAlert = __ds_scope.InlineAlert;
export const Modal = __ds_scope.Modal;
export const Tag = __ds_scope.Tag;
export const Tooltip = __ds_scope.Tooltip;
export const Button = __ds_scope.Button;
export const Checkbox = __ds_scope.Checkbox;
export const Radio = __ds_scope.Radio;
export const RadioGroup = __ds_scope.RadioGroup;
export const Select = __ds_scope.Select;
export const Switch = __ds_scope.Switch;
export const TextArea = __ds_scope.TextArea;
export const TextInput = __ds_scope.TextInput;
export const Icon = __ds_scope.Icon;
export const Breadcrumb = __ds_scope.Breadcrumb;
export const Pagination = __ds_scope.Pagination;
export const ProgressIndicator = __ds_scope.ProgressIndicator;
export const Tabs = __ds_scope.Tabs;
