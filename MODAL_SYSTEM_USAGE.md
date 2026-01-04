# Global Modal System & Micro-interactions - Usage Guide

This document describes the new modal system and micro-interaction components implemented in Phase 7 of the UI Refresh.

## Components Overview

### 1. Modal Component (`src/components/ui/modal.tsx`)

A reusable modal component with animations and accessibility features.

**Features:**

- Backdrop blur and fade-in animation
- Escape key to close
- Click outside to close
- Accessibility (ARIA attributes)
- Multiple size options: `sm`, `md`, `lg`, `xl`
- Optional title, description, and close button
- Body scroll lock when open

**Basic Usage:**

```tsx
import { Modal, ModalFooter } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Open Modal</Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Modal Title"
        description="Optional description"
        size="md"
      >
        <p>Modal content goes here...</p>

        <ModalFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleAction}>Confirm</Button>
        </ModalFooter>
      </Modal>
    </>
  )
}
```

### 2. ConfirmDialog Component (`src/components/ui/confirm-dialog.tsx`)

A styled confirmation dialog with icon variants.

**Variants:**

- `danger` - Red (for destructive actions)
- `warning` - Yellow (for warnings)
- `info` - Blue (for informational)
- `success` - Green (for confirmations)

**Features:**

- Icon with colored background
- Loading state with spinner
- Disabled buttons during loading
- Themed button colors based on variant

**Usage:**

```tsx
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

function DeleteButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    setLoading(true)
    try {
      await deleteItem()
      setIsOpen(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Delete</Button>

      <ConfirmDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={handleDelete}
        title="Delete Item"
        description="Are you sure? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        loading={loading}
      />
    </>
  )
}
```

### 3. LoadingSpinner Components (`src/components/ui/loading-spinner.tsx`)

Three loading indicator components for different use cases.

#### LoadingSpinner

A simple spinning loader icon.

```tsx
import { LoadingSpinner } from "@/components/ui/loading-spinner"

;<LoadingSpinner size="md" />
// Sizes: 'sm' | 'md' | 'lg'
```

#### LoadingOverlay

An overlay that covers content with a spinner and optional message.

```tsx
import { LoadingOverlay } from "@/components/ui/loading-spinner"

;<div className="relative">
  {/* Your content */}
  {isLoading && <LoadingOverlay message="Loading data..." />}
</div>
```

#### LoadingDots

Animated dots for inline loading states.

```tsx
import { LoadingDots } from "@/components/ui/loading-spinner"

;<span>
  Processing
  <LoadingDots />
</span>
```

### 4. ProgressBar Component (`src/components/ui/progress-bar.tsx`)

Progress indicators for long-running operations.

#### ProgressBar

A horizontal progress bar with variants.

```tsx
import { ProgressBar } from "@/components/ui/progress-bar"

;<ProgressBar value={75} size="md" variant="default" showLabel={true} />
// Sizes: 'sm' | 'md' | 'lg'
// Variants: 'default' | 'success' | 'warning' | 'danger'
```

#### ProgressSteps

Step-by-step progress indicator.

```tsx
import { ProgressSteps } from "@/components/ui/progress-bar"

;<ProgressSteps steps={["Upload", "Process", "Review", "Complete"]} currentStep={2} />
```

### 5. useConfirm Hook (`src/hooks/use-confirm.ts`)

A React hook for programmatic confirmation dialogs.

**Usage:**

```tsx
import { useConfirm } from "@/hooks/use-confirm"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

function MyComponent() {
  const { isOpen, title, description, loading, confirm, handleConfirm, handleClose } = useConfirm()

  const handleDeleteClick = () => {
    confirm({
      title: "Delete Item",
      description: "Are you sure you want to delete this item?",
      onConfirm: async () => {
        await deleteItem()
        toast.success("Item deleted")
      },
    })
  }

  return (
    <>
      <Button onClick={handleDeleteClick}>Delete</Button>

      <ConfirmDialog
        isOpen={isOpen}
        onClose={handleClose}
        onConfirm={handleConfirm}
        title={title}
        description={description}
        variant="danger"
        loading={loading}
      />
    </>
  )
}
```

## Enhanced Toast System

The Sonner toast system has been enhanced with design system styling.

**Already configured in `src/app/layout.tsx`:**

- Matches design system colors (uses CSS variables)
- Rounded corners matching card style
- Elevated shadow
- Rich colors enabled
- Close button enabled
- Expandable toasts

**Usage remains the same:**

```tsx
import { toast } from "@/lib/toast"

toast.success("Operation successful!")
toast.error("Error", "Something went wrong")
toast.info("Info message")
toast.warning("Warning message")
```

## Animations

New animations added to `src/app/globals.css`:

- `.animate-fade-in` - Fade in effect (used by modal backdrop)
- `.animate-scale-in` - Scale and fade in (used by modal content)
- `.animate-slide-up` - Slide up from bottom
- `.animate-slide-down` - Slide down from top

Use these classes for micro-interactions throughout the app.

## Real-World Examples

### Example 1: Updated Delete Buttons

Both `src/app/(dashboard)/products/delete-button.tsx` and `src/app/(dashboard)/contacts/delete-button.tsx` have been updated to use the new `ConfirmDialog` component instead of the native browser `confirm()` dialog.

### Example 2: Multi-step Form

```tsx
import { ProgressSteps } from "@/components/ui/progress-bar"
import { LoadingOverlay } from "@/components/ui/loading-spinner"

function MultiStepForm() {
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(false)

  const steps = ["Personal Info", "Company Details", "Review"]

  return (
    <div className="relative">
      <ProgressSteps steps={steps} currentStep={currentStep} />

      {/* Form content */}

      {loading && <LoadingOverlay message="Saving..." />}
    </div>
  )
}
```

### Example 3: File Upload Progress

```tsx
import { ProgressBar } from "@/components/ui/progress-bar"

function FileUpload() {
  const [uploadProgress, setUploadProgress] = useState(0)

  return (
    <div>
      <ProgressBar
        value={uploadProgress}
        variant={uploadProgress === 100 ? "success" : "default"}
        showLabel={true}
      />
    </div>
  )
}
```

## Best Practices

1. **Use ConfirmDialog for destructive actions** - Always confirm before deleting or permanently changing data
2. **Show loading states** - Use LoadingSpinner or LoadingOverlay during async operations
3. **Provide feedback** - Use toast notifications to confirm actions
4. **Keep modals focused** - Use modals for single, focused tasks
5. **Avoid modal stacking** - Don't open modals on top of other modals
6. **Use appropriate variants** - Match the variant to the action type (danger for delete, info for informational, etc.)
7. **Provide clear labels** - Use descriptive button labels like "Delete Product" instead of just "Delete"

## Accessibility

All components follow accessibility best practices:

- Keyboard navigation (Escape to close)
- ARIA attributes for screen readers
- Focus management
- Color contrast ratios
- Semantic HTML

## Files Created

- `/src/components/ui/modal.tsx` - Modal component
- `/src/components/ui/confirm-dialog.tsx` - Confirmation dialog
- `/src/components/ui/loading-spinner.tsx` - Loading indicators
- `/src/components/ui/progress-bar.tsx` - Progress components
- `/src/hooks/use-confirm.ts` - Confirmation hook

## Files Modified

- `/src/app/layout.tsx` - Enhanced Toaster styling
- `/src/app/globals.css` - Added animations
- `/src/app/(dashboard)/products/delete-button.tsx` - Updated to use ConfirmDialog
- `/src/app/(dashboard)/contacts/delete-button.tsx` - Updated to use ConfirmDialog

## Build Status

All components have been tested and the project builds successfully with no errors.
