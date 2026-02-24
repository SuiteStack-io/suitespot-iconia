

## Move Breadcrumb Inside Header on Restrictions Page

### Problem

On the Restrictions page, the breadcrumb (`Admin > PMS > Restrictions`) sits below the header bar in the main content area. On other pages like Prices, the breadcrumb is inside the header. This is inconsistent.

### Fix

**File: `src/pages/pms/Restrictions.tsx`**

1. Move the `<AdminBreadcrumb>` component from the main content area (currently below the header, around line 164) into the `<header>` element, placing it inside the header's container div — similar to how Prices and other pages do it.

2. Remove the standalone `<AdminBreadcrumb>` call from the content section below.

The header will change from:

```text
<header>
  <div> SlideMenu + Title </div>
</header>
<div> <!-- content -->
  <AdminBreadcrumb ... />
  ...
</div>
```

To:

```text
<header>
  <AdminBreadcrumb ... />
  <div> SlideMenu + Title </div>
</header>
<div> <!-- content -->
  ...
</div>
```

### Scope

- Single file change: `src/pages/pms/Restrictions.tsx`
- Move one component from content area into header
- Matches the layout pattern used in Prices, Availability, and Shuffle History pages

