# No Addict

**No Addict** is a lightweight Chrome extension that helps users reduce digital distraction by blocking access to selected websites. Users can add domains or specific URLs they want to avoid, enable or disable blocking as needed, and automatically prevent those pages from loading by clearing their content.

The extension focuses on simplicity, persistence, and reliability, allowing users to control their browsing habits without intrusive restrictions.

---

## Development Tasks

### Core Functionality

- [x] Set up Chrome Extension (Manifest V3)
- [x] Create popup interface
- [x] Persist blocked rules using `chrome.storage.local`
- [x] Display list of blocked rules in popup

### Rule Management

- [ ] Add new blocked rule from user input
- [ ] Automatically detect domain vs full URL
- [ ] Prevent duplicate rules
- [ ] Enable / disable a rule using a toggle switch
- [ ] Delete a blocked rule
- [ ] Persist rule state across browser restarts

### Page Blocking

- [ ] Load blocked rules in content script
- [ ] Match current page against enabled rules
- [ ] Block pages by removing or replacing page content
- [ ] Ensure blocking runs before page content loads

### Reliability & Edge Cases

- [ ] Handle `www` and non-`www` domains correctly
- [ ] Ignore disabled rules
- [ ] Safely handle empty rule lists
- [ ] Support long URLs without errors

### Optional Enhancements

- [ ] Dark mode support
- [ ] Temporary disable all rules
- [ ] Import / export blocked rules
- [ ] Confirmation before deleting a rule
