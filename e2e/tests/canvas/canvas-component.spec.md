# Canvas Component - Comprehensive Test Plan

## Application Overview

The Canvas Component is a document editing feature in the Mentor application that allows users to collaborate with the AI mentor to create, edit, and refine documents. Similar to OpenAI/Claude's canvas implementation, users can:

- **Document Generation**: Request the AI to generate documents (reports, essays, articles, etc.)
- **Canvas Toggle**: Enable/disable canvas mode via a toggle button in the chat input
- **Rich Text Editing**: Format content using toolbar buttons (Bold, Italic, Headings)
- **Version History**: Navigate through document versions using the three-dots menu
- **Text Selection Updates**: Highlight text and request AI to modify specific sections
- **Canvas Controls**: Adjust document length, reading level, add polish, and manage emojis
- **Export Options**: Export documents as PDF, DOCX, or Markdown

---

## Test Scenarios

### 1. Canvas Toggle Activation

**Seed:** `tests/mentornextjs/canvas/canvas-component.spec.ts`

#### 1.1 Enable Canvas Mode Toggle

**Steps:**
1. Navigate to the mentor platform page
2. Wait for the chat interface to fully load
3. Locate the Canvas toggle button in the chat input area (button with "Canvas" text)
4. Click the Canvas toggle button to enable canvas mode
5. Verify the Canvas button shows active state (highlighted/selected)

**Expected Results:**
- Canvas toggle button becomes visually active (different background/border color)
- The toggle state is maintained until explicitly changed
- User can now generate documents that will open in canvas view

#### 1.2 Disable Canvas Mode Toggle

**Steps:**
1. With Canvas mode enabled, click the Canvas toggle button again
2. Verify the Canvas button returns to inactive state

**Expected Results:**
- Canvas toggle button returns to normal/inactive appearance
- Generated responses will appear in chat without opening canvas

---

### 2. Document Generation with Canvas

**Seed:** `tests/mentornextjs/canvas/canvas-component.spec.ts`

#### 2.1 Generate a Business Report Document

**Steps:**
1. Enable Canvas mode by clicking the Canvas toggle
2. Type in the chat input: "Create a comprehensive quarterly business report for a technology startup. Include sections for: Executive Summary, Financial Overview, Key Metrics, Challenges Faced, and Future Outlook. Use placeholder data for a Q3 2024 report."
3. Press Enter or click the Send button
4. Wait for the AI response to complete

**Expected Results:**
- Loading indicator appears while generating
- Canvas panel opens on the right side of the screen
- Document title appears in the canvas header
- Generated content appears in the rich text editor area
- Content includes proper formatting (headings, paragraphs, lists)
- "All changes saved" indicator shows after content loads

#### 2.2 Generate a Technical Documentation

**Steps:**
1. Enable Canvas mode
2. Type: "Write API documentation for a user authentication endpoint. Include: endpoint URL, HTTP method, request parameters, request body example, response format, error codes, and usage examples."
3. Send the message and wait for response

**Expected Results:**
- Canvas opens with the generated technical documentation
- Code blocks and formatting are properly rendered
- Document is editable in the canvas view

#### 2.3 Generate an Educational Article

**Steps:**
1. Enable Canvas mode
2. Type: "Create an educational article explaining the fundamentals of machine learning for beginners. Include sections on: What is Machine Learning, Types of ML (Supervised, Unsupervised, Reinforcement), Real-world Applications, and Getting Started resources."
3. Send and wait for response

**Expected Results:**
- Canvas displays a well-structured educational article
- Headings, subheadings, and paragraphs are properly formatted
- Content is suitable for editing and refinement

---

### 3. Canvas Panel Interaction

**Seed:** `tests/mentornextjs/canvas/canvas-component.spec.ts`

#### 3.1 Verify Canvas Header Elements

**Steps:**
1. After generating a document in canvas
2. Verify the canvas header displays:
   - Document title (clickable for rename)
   - FileText icon
   - Version navigation (three dots menu if versions exist)
   - Toolbar with formatting buttons
   - Export dropdown button
   - Close (X) button

**Expected Results:**
- All header elements are visible and properly positioned
- Title is truncated if too long
- Toolbar buttons are accessible

#### 3.2 Close and Reopen Canvas

**Steps:**
1. With canvas open, click the X (close) button in canvas header
2. Verify canvas panel closes
3. In the chat, locate the artifact/document card in the AI response
4. Click on the artifact card to reopen canvas

**Expected Results:**
- Canvas closes smoothly with any pending changes saved
- Chat expands to full width
- Clicking artifact card reopens the canvas with same content
- Version history is preserved

#### 3.3 Rename Canvas Document

**Steps:**
1. Click on the document title in the canvas header
2. Rename dialog/modal appears
3. Enter new title: "My Custom Report Title"
4. Click Save or press Enter
5. Verify title updates

**Expected Results:**
- Rename modal appears with current title pre-filled
- New title is saved and displayed
- Toast notification confirms "Canvas title updated"

---

### 4. Rich Text Editing and Formatting

**Seed:** `tests/mentornextjs/canvas/canvas-component.spec.ts`

#### 4.1 Apply Bold Formatting

**Steps:**
1. With canvas open and content loaded
2. Select a portion of text in the editor (e.g., select "Executive Summary")
3. Click the Bold (B) button in the toolbar
4. Verify the selected text becomes bold

**Expected Results:**
- Selected text appears in bold weight
- Bold button shows active/selected state
- "Saving..." indicator appears briefly, then "All changes saved"

#### 4.2 Apply Italic Formatting

**Steps:**
1. Select different text in the editor
2. Click the Italic (I) button in the toolbar
3. Verify the selected text becomes italicized

**Expected Results:**
- Selected text appears in italic style
- Italic button shows active/selected state
- Changes are auto-saved

#### 4.3 Apply Heading Formatting

**Steps:**
1. Click at the start of a paragraph
2. Click the H1 button in the toolbar
3. Verify the line becomes a Heading 1
4. Repeat for H2 and H3 buttons

**Expected Results:**
- Text transforms to appropriate heading level
- Font size and weight change accordingly
- Heading buttons toggle between active/inactive states

#### 4.4 Undo and Redo Operations

**Steps:**
1. Make several formatting changes (bold, italic, add text)
2. Click the Undo button multiple times
3. Verify changes are reversed
4. Click the Redo button
5. Verify changes are restored

**Expected Results:**
- Undo reverses changes in correct order
- Redo restores changes correctly
- Undo/Redo buttons enable/disable appropriately based on history

---

### 5. Version History Navigation

**Seed:** `tests/mentornextjs/canvas/canvas-component.spec.ts`

#### 5.1 Access Version Menu

**Steps:**
1. Generate a document in canvas
2. Make some edits to create a new version (wait for auto-save)
3. Locate the three-dots (More options) menu next to the title
4. Click to open the dropdown menu

**Expected Results:**
- Dropdown menu appears with version navigation options
- Shows "Previous Version" and "Next Version" options
- Displays current version number (e.g., "Version 2 of 3")

#### 5.2 Navigate to Previous Version

**Steps:**
1. Open the version dropdown menu
2. Click "Previous Version" option
3. Wait for version to load

**Expected Results:**
- Content changes to show previous version
- Yellow/amber banner appears: "You are viewing a previous version"
- "Restore this version" and "Back to latest version" buttons appear
- Editor becomes read-only (cannot edit old versions)

#### 5.3 Navigate to Next Version

**Steps:**
1. While viewing a previous version
2. Open version menu and click "Next Version"

**Expected Results:**
- Content updates to show the next version
- Version counter updates accordingly
- If at latest version, "Next Version" becomes disabled

#### 5.4 Restore Previous Version

**Steps:**
1. Navigate to a previous version
2. Click "Restore this version" button

**Expected Results:**
- Toast notification: "Version restored"
- Version becomes the current version
- Editor becomes editable again
- Warning banner disappears

#### 5.5 Return to Latest Version

**Steps:**
1. While viewing a previous version
2. Click "Back to latest version" button

**Expected Results:**
- Canvas shows the latest/current version content
- Editor is editable
- Warning banner disappears

---

### 6. Text Selection and Partial Updates

**Seed:** `tests/mentornextjs/canvas/canvas-component.spec.ts`

#### 6.1 Highlight Text and Show Popup

**Steps:**
1. With document loaded in canvas
2. Select a paragraph of text by clicking and dragging
3. Observe the highlight popup that appears

**Expected Results:**
- Blue highlight overlay appears on selected text
- Popup appears below the selection with an input field
- Popup has "Ask Anything..." placeholder
- My Mentors icon is visible in popup

#### 6.2 Send Partial Update Request

**Steps:**
1. Select a paragraph (e.g., the introduction section)
2. In the popup input, type: "Make this more engaging and add statistics"
3. Press Enter to send the request

**Expected Results:**
- Popup closes
- Message is sent to the AI with context of selected text
- Canvas shows loading/updating state
- Only the selected section is updated
- Other content remains unchanged
- New version is created

#### 6.3 Cancel Text Selection

**Steps:**
1. Select text to show the popup
2. Press Escape key or click outside the popup

**Expected Results:**
- Popup closes
- Text selection is cleared
- No message is sent

---

### 7. Canvas Controls (Floating Panel)

**Seed:** `tests/mentornextjs/canvas/canvas-component.spec.ts`

#### 7.1 Open Canvas Controls Panel

**Steps:**
1. With canvas open and on current version
2. Locate the floating pencil button in bottom-right corner
3. Hover over or click the pencil button

**Expected Results:**
- Panel expands to show control options
- Options visible: Adjust length, Reading level, Add final polish, Add emojis

#### 7.2 Adjust Document Length

**Steps:**
1. Click the "Adjust the length" icon (up/down arrows)
2. Drag the slider to "Shorter"
3. Click the send/arrow-up button that appears

**Expected Results:**
- Slider interface appears with length options (Longest → Shortest)
- Label shows current selection
- Clicking send triggers AI to shorten the document
- Document content is updated with shorter version

#### 7.3 Adjust Reading Level

**Steps:**
1. Click the "Reading level" icon (book icon)
2. Drag slider to "Middle School"
3. Click send button

**Expected Results:**
- Slider shows reading levels (Graduate School → Kindergarten)
- AI rewrites content at selected reading level
- Document updates with simpler/more complex language

#### 7.4 Add Final Polish

**Steps:**
1. Click the "Add final polish" icon (sparkles)
2. Click the send button that appears

**Expected Results:**
- AI adds finishing touches to the document
- Checks grammar, consistency, adds titles if needed
- Document shows updated polished content

#### 7.5 Add Emojis Options

**Steps:**
1. Click the "Add emojis" icon (smiley face)
2. Grid of options appears: Words, Sections, Lists, Remove
3. Click "Sections" option

**Expected Results:**
- Emoji options panel appears
- Selecting "Sections" adds emojis to section headers
- Document updates with decorative emojis

---

### 8. Export Functionality

**Seed:** `tests/mentornextjs/canvas/canvas-component.spec.ts`

#### 8.1 Export as PDF

**Steps:**
1. With document in canvas
2. Click the Export dropdown button
3. Select "PDF Document" option
4. Wait for download

**Expected Results:**
- Dropdown shows export options (PDF, Word, Markdown)
- PDF file downloads with sanitized filename
- Toast notification: "Document exported as PDF"

#### 8.2 Export as DOCX

**Steps:**
1. Click Export dropdown
2. Select "Microsoft Word" option

**Expected Results:**
- DOCX file downloads
- Toast notification: "Document exported as DOCX"
- File contains formatted content

#### 8.3 Export as Markdown

**Steps:**
1. Click Export dropdown
2. Select "Markdown Document" option

**Expected Results:**
- .md file downloads
- Content is in proper markdown format
- Toast notification: "Document exported as Markdown"

---

### 9. Sending Messages with Canvas Context

**Seed:** `tests/mentornextjs/canvas/canvas-component.spec.ts`

#### 9.1 Send Follow-up Message While Canvas is Open

**Steps:**
1. With canvas open and document loaded
2. In the chat input, type: "Add a section about competitive analysis at the end"
3. Send the message

**Expected Results:**
- Message is sent with canvas/artifact context
- AI understands to modify the current canvas document
- Canvas content updates with the new section
- New version is created

#### 9.2 Request Specific Modifications

**Steps:**
1. Type: "Change all the dates in the report to Q4 2024"
2. Send message

**Expected Results:**
- AI modifies the existing canvas document
- Dates are updated throughout
- Version history increments

---

### 10. Edge Cases and Error Handling

**Seed:** `tests/mentornextjs/canvas/canvas-component.spec.ts`

#### 10.1 Empty Canvas Content

**Steps:**
1. Observe canvas behavior if content fails to load

**Expected Results:**
- Loading shimmer animation appears
- Error message if content unavailable
- Graceful fallback to empty editor

#### 10.2 Long Document Performance

**Steps:**
1. Generate a very long document (request a 10-page report)
2. Test scrolling and editing

**Expected Results:**
- Canvas handles long content smoothly
- Scrolling is performant
- Auto-save works correctly

#### 10.3 Concurrent Editing and Streaming

**Steps:**
1. While AI is updating the canvas (streaming)
2. Attempt to type/edit in the editor

**Expected Results:**
- Editor may be locked during streaming
- User edits don't interfere with incoming content
- Final state is consistent

---

## Test Configuration Notes

### Prerequisites
- User must be authenticated
- Canvas/Artifacts feature must be enabled for the tenant
- Valid LLM provider must be configured

### Test Data Examples
- Business reports, technical docs, educational content
- Use realistic prompts that generate substantial content
- Test with various document lengths and complexities

### Selectors Reference
```typescript
// Canvas toggle button
page.getByRole('button', { name: 'Canvas' })

// Canvas container
page.locator('.bg-white.flex.flex-col.relative.h-full')

// Canvas title (clickable for rename)
page.locator('button.font-medium.text-gray-900')

// Toolbar buttons
page.getByRole('button', { name: 'Toggle bold' })
page.getByRole('button', { name: 'Toggle italic' })
page.getByRole('button', { name: 'Toggle heading 1' })
page.getByRole('button', { name: 'Undo' })
page.getByRole('button', { name: 'Redo' })

// Version menu
page.locator('button:has(svg.lucide-more-vertical)')

// Export dropdown
page.getByRole('button', { name: /Export/i })

// Close button
page.locator('button:has(svg.lucide-x)')

// Rich text editor content area
page.locator('[contenteditable="true"]')

// Canvas controls (floating panel)
page.locator('.fixed.bottom-6.right-16')
page.locator('button:has(svg.lucide-pencil)')

// Highlight popup
page.locator('.highlight-popup')
page.locator('#partial-update-input')

// Version banner
page.getByText('You are viewing a previous version')
page.getByRole('button', { name: 'Restore this version' })
page.getByRole('button', { name: 'Back to latest version' })
```

### Quality Standards
- All tests should be independent and run in any order
- Clean up created artifacts after tests
- Use proper waiting strategies for AI responses (up to 120s timeout)
- Capture screenshots on failure for debugging

