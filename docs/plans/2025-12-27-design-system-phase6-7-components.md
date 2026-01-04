# Phase 6-7: Component Migration

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate core UI components to use design tokens instead of hardcoded colors.

**Architecture:** Update Button, Badge, Input, Card, Alert components to use semantic Tailwind classes.

**Tech Stack:** React, Tailwind CSS, CVA

---

## Task 1: Migrate Button Component

**Files:**

- Modify: `src/components/ui/button.tsx`

**Step 1: Read current implementation**

```bash
cat src/components/ui/button.tsx
```

**Step 2: Replace with token-based implementation**

```typescript
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base styles
  "inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors focus-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-interactive text-inverse hover:bg-interactive-hover",
        secondary:
          "bg-surface border border-border text-foreground hover:bg-surface-1",
        danger:
          "bg-danger text-inverse hover:bg-danger/90",
        ghost:
          "text-foreground hover:bg-surface-1",
        link:
          "text-link underline-offset-4 hover:underline",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-surface-1",
      },
      size: {
        sm: "h-8 px-3 text-body-sm",
        md: "h-10 px-4 text-body-base",
        lg: "h-12 px-6 text-body-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

**Step 3: Verify button renders**

```bash
npm run dev &
sleep 5
# Manually check a page with buttons
kill %1
```

---

## Task 2: Migrate Badge Component

**Files:**

- Modify: `src/components/ui/badge.tsx`

**Step 1: Read current implementation**

```bash
cat src/components/ui/badge.tsx
```

**Step 2: Replace with token-based implementation**

```typescript
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  // Base styles
  "inline-flex items-center rounded-md px-2.5 py-0.5 text-body-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-interactive text-inverse",
        secondary:
          "bg-surface-1 text-secondary border border-border",
        success:
          "bg-success-bg text-success-text border border-success-border",
        warning:
          "bg-warning-bg text-warning-text border border-warning-border",
        danger:
          "bg-danger-bg text-danger-text border border-danger-border",
        info:
          "bg-info-bg text-info-text border border-info-border",
        outline:
          "border border-border text-foreground bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
```

---

## Task 3: Migrate Input Component

**Files:**

- Modify: `src/components/ui/input.tsx`

**Step 1: Read current implementation**

```bash
cat src/components/ui/input.tsx
```

**Step 2: Replace with token-based implementation**

```typescript
import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Base styles
          "flex h-10 w-full rounded-md border px-3 py-2 text-body-base",
          "bg-surface text-foreground placeholder:text-muted",
          "transition-colors file:border-0 file:bg-transparent file:text-body-sm file:font-medium",
          // Focus styles
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2",
          // Disabled styles
          "disabled:cursor-not-allowed disabled:opacity-50",
          // Default border
          !error && "border-border",
          // Error state
          error && "border-danger focus-visible:ring-danger",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
```

---

## Task 4: Migrate Textarea Component

**Files:**

- Modify: `src/components/ui/textarea.tsx`

**Step 1: Read current implementation**

```bash
cat src/components/ui/textarea.tsx
```

**Step 2: Replace with token-based implementation**

```typescript
import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          // Base styles
          "flex min-h-[80px] w-full rounded-md border px-3 py-2 text-body-base",
          "bg-surface text-foreground placeholder:text-muted",
          "transition-colors resize-none",
          // Focus styles
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2",
          // Disabled styles
          "disabled:cursor-not-allowed disabled:opacity-50",
          // Default border
          !error && "border-border",
          // Error state
          error && "border-danger focus-visible:ring-danger",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
```

---

## Task 5: Migrate Card Component

**Files:**

- Modify: `src/components/ui/card.tsx`

**Step 1: Read current implementation**

```bash
cat src/components/ui/card.tsx
```

**Step 2: Replace with token-based implementation**

```typescript
import * as React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border border-border bg-surface shadow-card",
      className
    )}
    {...props}
  />
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-heading-md text-foreground", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-body-sm text-secondary", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
```

---

## Task 6: Migrate Alert Component

**Files:**

- Modify: `src/components/ui/alert.tsx`

**Step 1: Read current implementation**

```bash
cat src/components/ui/alert.tsx
```

**Step 2: Replace with token-based implementation**

```typescript
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4",
  {
    variants: {
      variant: {
        default: "bg-surface text-foreground border-border",
        success: "bg-success-bg text-success-text border-success-border [&>svg]:text-success-icon",
        warning: "bg-warning-bg text-warning-text border-warning-border [&>svg]:text-warning-icon",
        danger: "bg-danger-bg text-danger-text border-danger-border [&>svg]:text-danger-icon",
        info: "bg-info-bg text-info-text border-info-border [&>svg]:text-info-icon",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
));
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
));
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-body-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };
```

---

## Task 7: Run Type Check

**Step 1: Check for TypeScript errors**

```bash
npx tsc --noEmit src/components/ui/button.tsx src/components/ui/badge.tsx src/components/ui/input.tsx src/components/ui/textarea.tsx src/components/ui/card.tsx src/components/ui/alert.tsx 2>&1
```

Expected: No errors

---

## Task 8: Commit Phase 6-7

**Step 1: Commit changes**

```bash
git add src/components/ui/button.tsx
git add src/components/ui/badge.tsx
git add src/components/ui/input.tsx
git add src/components/ui/textarea.tsx
git add src/components/ui/card.tsx
git add src/components/ui/alert.tsx
git commit -m "feat(design-system): migrate core components to tokens (phase 6-7)

- Update Button: use semantic interactive colors
- Update Badge: use status color bundles (success/warning/danger/info)
- Update Input/Textarea: use surface, border, text tokens
- Update Card: use surface, border, shadow tokens
- Update Alert: use status color bundles
- All components now use design tokens instead of hardcoded colors"
```

---

## Verification Checklist

- [ ] Button uses `bg-interactive`, `text-inverse`, etc.
- [ ] Badge uses `bg-success-bg`, `text-success-text`, etc.
- [ ] Input uses `bg-surface`, `border-border`, `text-foreground`
- [ ] Card uses `bg-surface`, `border-border`, `shadow-card`
- [ ] Alert uses status color bundles
- [ ] No hardcoded colors (blue-600, gray-200, etc.) remain
- [ ] TypeScript check passes
- [ ] Components render correctly
- [ ] Commit created
