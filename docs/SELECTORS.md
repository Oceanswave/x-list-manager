# X UI Selectors Reference

This document lists the critical CSS/XPath selectors used by `x-list-manager`. If X changes their UI, update these selectors in `scripts/cli.ts`.

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

## List Management Dialog
- **Dialog Container**: `[role="dialog"]:has(div[role="checkbox"]):visible`
  - The modal dialog containing the list checkboxes.
- **List Checkbox**: `div[role="checkbox"]:has-text("${listName}")`
  - The specific checkbox for a given list name.
- **Save Button**: `[role="dialog"] [role="button"]:has-text("Save")`
  - The button to confirm changes.

## Lists Page
- **List Item Container**: `[data-testid="cellInnerDiv"]`
  - Container for individual list items on the lists page.

## Notes
- Selectors rely heavily on `data-testid` attributes where available, as these are more stable than classes.
- Text-based selectors (e.g., `:has-text("Save")`) are sensitive to language settings; ensure the browser runs in English or update the text.
