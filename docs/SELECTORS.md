# X UI Selectors Reference

Critical CSS/XPath selectors used by `x-list-manager`. If X changes their UI,
update BOTH this file and `scripts/cli.ts`. Verified live 2026-08-12.

## Core Navigation
- **Login Check**: `[data-testid="SideNav_AccountSwitcher_Button"]`
  - Used to verify if the user is logged in.
- **Profile Link**: `[data-testid="AppTabBar_Profile_Link"]`
  - Used to find the current user's profile URL.

## User Actions (Add/Remove)
- **User Actions Button**: `[data-testid="userActions"]`
  - The "..." button on a user's profile page.
- **Add/Remove Menu Item**: `[role="menuitem"]:has-text("Add/remove from Lists")`
  - The menu item to open the list management dialog.
  - Fallback: `[role="menuitem"]:has-text("Lists")`
  - NOTE: the dropdown animates in over 1-2s -- WAIT for the menuitem
    selector with a timeout; fixed delays fail.

## List Management Dialog
- **Dialog Container**: `[role="dialog"]:has(div[role="checkbox"]):visible`
  - The modal dialog containing the list checkboxes.
- **List Checkbox**: `div[role="checkbox"]:has-text("${listName}")`
  - The specific checkbox for a given list name.
- **Save Button**: `[role="dialog"] [role="button"]:has-text("Save")`
  - The button to confirm changes.

## Create List (URL: https://x.com/i/lists/create)
- **Name Input**: `input[name="name"]`
- **Description**: `textarea[name="description"]`
- **Make Private**: `input[type="checkbox"]`
- **Next Button**: `getByRole('button', { name: 'Next', exact: true })`
  - After Next, X redirects to `/i/lists/<id>/members/suggested` -- the list
    EXISTS at that point; the ID is in the URL.
- **Done Button** (closes the "Add to your List" member form):
  `getByRole('button', { name: 'Done', exact: true })` -- best-effort.

## Edit / Delete List (URL: /i/lists/<id>/info)
- **Edit List Link**: `getByRole('link', { name: 'Edit List' })` (href
  `/i/lists/<id>/info`)
- **Delete List** (inside edit dialog): `getByText('Delete List', { exact: true })`
- **Confirm Delete**: `[data-testid="confirmationSheetConfirm"]`
  - CRITICAL: the confirmation sheet is `role="alertdialog"` (NOT "dialog")
    with a ZERO-SIZE rect -- it never registers as visible. Wait on the
    BUTTON, never on the dialog element.

## Lists Page
- **List Item Container**: `[data-testid="cellInnerDiv"]`
  - Container for individual list items on the lists page.

## Notes
- Selectors rely heavily on `data-testid` attributes where available, as
  these are more stable than classes.
- Text-based selectors (e.g., `:has-text("Save")`) are sensitive to language
  settings; ensure the browser runs in English or update the text.
- JS `element.click()` does NOT fire React synthetic events on X buttons --
  use native Playwright clicks. Menu items sometimes DO respond to JS
  clicks; when one fails, try the other.
