## Classes

<dl>
<dt><a href="#TabHandler">TabHandler</a></dt>
<dd><p>Handle returned by <code>menu.addTab()</code>. Use it to add or remove items
from the tab after the menu has been mounted.</p>
</dd>
<dt><a href="#FolderHandler">FolderHandler</a></dt>
<dd><p>Handle returned by <code>tab.addFolder()</code>. Use it to add or remove items
inside the folder after the menu has been mounted. Symmetric to <a href="#TabHandler">TabHandler</a>:
a folder visually groups a set of controls inside a tab and (optionally) can be
collapsed/expanded by clicking its header.</p>
</dd>
<dt><a href="#ItemHandler">ItemHandler</a></dt>
<dd><p>Handle returned by <code>tab.addItem()</code>. Use it to react to value
changes and, for select controls, to update the options list at runtime.</p>
</dd>
</dl>

## Members

<dl>
<dt><a href="#protocolVersion">protocolVersion</a> : <code>string</code></dt>
<dd><p>Protocol/contract version this DynamicMenu build speaks. The same
value is stamped onto every <code>getMenuState()</code> snapshot as <code>version</code>,
and CanvasRenderer validates it on <code>setState()</code>. See <code>protocol.js</code>.</p>
</dd>
</dl>

## Functions

<dl>
<dt><a href="#createMenu">createMenu(menuContainer, [options])</a> ⇒ <code><a href="#MenuAPI">Promise.&lt;MenuAPI&gt;</a></code></dt>
<dd><p>Mount a DynamicMenu into a DOM container and return its API.</p>
</dd>
<dt><a href="#addTab">addTab(tabName, [icon])</a> ⇒ <code><a href="#TabHandler">TabHandler</a></code></dt>
<dd><p>Add a new tab to the menu.</p>
</dd>
<dt><a href="#removeTab">removeTab(tab)</a></dt>
<dd><p>Remove a tab previously created with <code>addTab</code>.</p>
</dd>
<dt><a href="#sync">sync()</a></dt>
<dd><p>Re-read all bound objects and push their current values to the menu.
Call this after external code changes a bound property without going
through the menu API.</p>
</dd>
<dt><a href="#isFocusNavEnabled">isFocusNavEnabled()</a> ⇒ <code>boolean</code></dt>
<dd><p>Whether device-agnostic focus navigation is enabled (set via the
<code>focusNavigation</code> option). When false, all <code>move*</code>/<code>activate</code> calls
are no-ops. Use this to decide whether to show a D-pad / wire input.</p>
</dd>
<dt><a href="#moveUp">moveUp()</a></dt>
<dd><p>Move keyboard/gamepad focus one row up.</p>
</dd>
<dt><a href="#moveDown">moveDown()</a></dt>
<dd><p>Move keyboard/gamepad focus one row down.</p>
</dd>
<dt><a href="#moveLeft">moveLeft()</a></dt>
<dd><p>Move focus left (e.g. previous button in a button row, previous tree option).</p>
</dd>
<dt><a href="#moveRight">moveRight()</a></dt>
<dd><p>Move focus right.</p>
</dd>
<dt><a href="#clickFocusedButton">clickFocusedButton()</a> ⇒ <code>Object</code></dt>
<dd><p>Click the button targeted inside the focused action row.
Does nothing when focus is not currently on a button control.</p>
</dd>
<dt><a href="#activate">activate()</a></dt>
<dd><p>Activate the currently focused control.
For buttons this fires the action; for switches it toggles; for sliders it
commits the in-flight value.</p>
</dd>
<dt><a href="#press">press(direction)</a></dt>
<dd><p>Press-and-hold a direction. Fires the matching action once immediately
and then auto-repeats while held — e.g. holding <code>&#39;left&#39;</code>/<code>&#39;right&#39;</code> over a
slider ramps its value gradually. Always pair with <a href="#release">release</a>.
<code>&#39;activate&#39;</code> fires once and does not repeat.</p>
<p>Wire this to a button&#39;s pointerdown / a key&#39;s keydown / a VR trigger press.</p>
</dd>
<dt><a href="#release">release(direction)</a></dt>
<dd><p>Release a previously <a href="#press">press</a>ed direction, stopping its auto-repeat.
Wire to pointerup / pointerleave / keyup / VR trigger release.</p>
</dd>
<dt><a href="#beginFocusedValueAdjustment">beginFocusedValueAdjustment()</a></dt>
<dd><p>Start a continuous adjustment session on the focused slider.</p>
</dd>
<dt><a href="#adjustFocusedValue">adjustFocusedValue(normalizedDelta)</a> ⇒ <code>boolean</code></dt>
<dd><p>Adjust the captured slider by a fraction of its complete range.</p>
</dd>
<dt><a href="#endFocusedValueAdjustment">endFocusedValueAdjustment()</a></dt>
<dd><p>Finish the active continuous adjustment session and commit its value.</p>
</dd>
<dt><a href="#deactivateFocusNavigation">deactivateFocusNavigation()</a></dt>
<dd><p>Hide and reset the focus-navigation cursor. The next moveDown call
reactivates it on the current tab in the top bar.</p>
</dd>
<dt><a href="#setVisible">setVisible(visible)</a></dt>
<dd><p>Show or hide the menu panel.</p>
</dd>
<dt><a href="#updateSelectOptions">updateSelectOptions(target, [newOptionsOrItemIndex], [newOptions])</a></dt>
<dd><p>Update the options list of a select control at runtime.</p>
<p>Accepts three calling signatures:</p>
<ul>
<li><code>updateSelectOptions(itemHandler, newOptions)</code></li>
<li><code>updateSelectOptions({ tabIndex, itemIndex }, newOptions)</code></li>
<li><code>updateSelectOptions(tabIndex, itemIndex, newOptions)</code></li>
</ul>
</dd>
<dt><a href="#onUiChange">onUiChange(cb)</a></dt>
<dd><p>Replace the UI-change callback. Pass <code>null</code> to disable.
The callback receives <code>{ tabIndex, itemIndex, type, value }</code>.</p>
</dd>
<dt><a href="#getMenuState">getMenuState()</a> ⇒ <code>object</code></dt>
<dd><p>Return a serializable snapshot of the full menu state.
Pass this to <code>CanvasRenderer.setState()</code> to initialize the renderer.</p>
</dd>
<dt><a href="#getVisibleTabState">getVisibleTabState()</a> ⇒ <code>object</code></dt>
<dd><p>Return a snapshot of only the currently visible tab&#39;s items.</p>
</dd>
<dt><a href="#subscribe">subscribe(listener)</a></dt>
<dd><p>Subscribe to menu events (used internally by <code>CanvasRenderer</code>).
The listener is called with an event object:
<code>{ type: &#39;tabChange&#39;|&#39;structureChange&#39;|&#39;controlChange&#39;|&#39;controlCommit&#39;|&#39;visibilityChange&#39;, ... }</code></p>
</dd>
<dt><a href="#unsubscribe">unsubscribe(listener)</a></dt>
<dd><p>Remove a previously registered listener.</p>
</dd>
<dt><a href="#executeCommand">executeCommand(cmd)</a></dt>
<dd><p>Execute a logical command — the same command objects emitted by
<code>CanvasRenderer.onCommand</code>. Use this to wire canvas pointer
interactions back into the DynamicMenu state.</p>
<p>Supported commands:</p>
<ul>
<li><code>{ type: &#39;set-tab&#39;, tabId }</code></li>
<li><code>{ type: &#39;cycle&#39;, tabId, itemId, payload: { direction: &#39;prev&#39;|&#39;next&#39; } }</code></li>
<li><code>{ type: &#39;toggle&#39;, tabId, itemId }</code></li>
<li><code>{ type: &#39;toggle-folder&#39;, tabId, itemId }</code></li>
<li><code>{ type: &#39;activate&#39;, tabId, itemId, payload: { buttonIndex, buttonLabel } }</code></li>
<li><code>{ type: &#39;set-slider-raw&#39;, tabId, itemId, payload: { rawValue } }</code></li>
<li><code>{ type: &#39;set-value&#39;, tabId, itemId, payload: { value } }</code></li>
</ul>
</dd>
<dt><a href="#setCurrentTab">setCurrentTab(tabId)</a></dt>
<dd><p>Programmatically switch to a tab by its ID.</p>
</dd>
</dl>

## Typedefs

<dl>
<dt><a href="#MenuAPI">MenuAPI</a> : <code>object</code></dt>
<dd><p>The public interface returned by <a href="#createMenu">createMenu</a>.</p>
</dd>
</dl>

<a name="TabHandler"></a>

## TabHandler
Handle returned by `menu.addTab()`. Use it to add or remove itemsfrom the tab after the menu has been mounted.

**Kind**: global class  

* [TabHandler](#TabHandler)
    * [new TabHandler()](#new_TabHandler_new)
    * [.addItem(arg1, [arg2], [arg3])](#TabHandler+addItem) ⇒ [<code>ItemHandler</code>](#ItemHandler)
    * [.addFolder(label, [opts])](#TabHandler+addFolder) ⇒ [<code>FolderHandler</code>](#FolderHandler)
    * [.removeItem(item)](#TabHandler+removeItem)

<a name="new_TabHandler_new"></a>

### new TabHandler()
**Example**  
```js
const tab = menu.addTab('Settings', 'fa-cog');// Signature 1 – item config objectconst vol = tab.addItem({ type: 'slider', label: 'Volume', min: 0, max: 1 });// Signature 2 – bind to an existing object propertyconst obj = { speed: 0.5 };const spd = tab.addItem(obj, 'speed', { type: 'slider', label: 'Speed', min: 0, max: 1 });
```
<a name="TabHandler+addItem"></a>

### tabHandler.addItem(arg1, [arg2], [arg3]) ⇒ [<code>ItemHandler</code>](#ItemHandler)
Add a control item to this tab.**Signature 1 – config object:**```jstab.addItem({ type, label, min, max, ... })```**Signature 2 – bound object property:**```jstab.addItem(object, propertyName, { type, label, ... })```When binding an object property the item's `initialValue` is read from`object[propertyName]` automatically.**Item config fields by type:**| type        | required fields                              | optional fields                        ||-------------|----------------------------------------------|----------------------------------------|| `slider`    | `label`, `min`, `max`                        | `step`, `easing`, `initialValue`       || `select`    | `label`, `options` (array or `{key:label}`)  | `initialValue`                         || `switch`    | `label`                                      | `initialValue` (boolean)               || `button`    | `buttons` (string array)                     | `rowLabel`, `action` (Function)        || `treeList`  | `label`, `tree` (nested object or array)     | `initialValue` (path array)            || `separator` | —                                            | —                                      |To group controls under a collapsible header use [addFolder](#TabHandler+addFolder) instead.

**Kind**: instance method of [<code>TabHandler</code>](#TabHandler)  

| Param | Type | Description |
| --- | --- | --- |
| arg1 | <code>object</code> \| <code>any</code> | Item config object **or** the object to bind. |
| [arg2] | <code>string</code> | Property name on `arg1` (signature 2 only). |
| [arg3] | <code>object</code> | Item config overrides (signature 2 only). |

<a name="TabHandler+addFolder"></a>

### tabHandler.addFolder(label, [opts]) ⇒ [<code>FolderHandler</code>](#FolderHandler)
Add a collapsible folder (visual group of controls) to this tab. Returns a[FolderHandler](#FolderHandler) — symmetric to `menu.addTab()` — through which you add orremove the folder's child controls.

**Kind**: instance method of [<code>TabHandler</code>](#TabHandler)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| label | <code>string</code> |  | Header text shown on the folder. |
| [opts] | <code>object</code> |  | Folder options. |
| [opts.collapsed] | <code>boolean</code> | <code>false</code> | Start collapsed (closed). |
| [opts.collapsible] | <code>boolean</code> |  | Allow click-to-collapse. Defaults to the   menu-wide `collapsibleFolders` option passed to `createMenu`. |

**Example**  
```js
const folder = tab.addFolder('Advanced');folder.addItem({ type: 'slider', label: 'Detail', min: 0, max: 10, step: 1 });
```
<a name="TabHandler+removeItem"></a>

### tabHandler.removeItem(item)
Remove an item from this tab.

**Kind**: instance method of [<code>TabHandler</code>](#TabHandler)  

| Param | Type | Description |
| --- | --- | --- |
| item | [<code>ItemHandler</code>](#ItemHandler) | The handler returned by `addItem`. |

<a name="FolderHandler"></a>

## FolderHandler
Handle returned by `tab.addFolder()`. Use it to add or remove itemsinside the folder after the menu has been mounted. Symmetric to [TabHandler](#TabHandler):a folder visually groups a set of controls inside a tab and (optionally) can becollapsed/expanded by clicking its header.

**Kind**: global class  

* [FolderHandler](#FolderHandler)
    * [new FolderHandler()](#new_FolderHandler_new)
    * [.addItem(arg1, [arg2], [arg3])](#FolderHandler+addItem) ⇒ [<code>ItemHandler</code>](#ItemHandler)
    * [.removeItem(item)](#FolderHandler+removeItem)

<a name="new_FolderHandler_new"></a>

### new FolderHandler()
**Example**  
```js
const tab = menu.addTab('Settings', 'fa-cog');const folder = tab.addFolder('Advanced');// Same signatures as tab.addItem:folder.addItem({ type: 'slider', label: 'Detail', min: 0, max: 10, step: 1 });const obj = { speed: 0.5 };folder.addItem(obj, 'speed', { type: 'slider', label: 'Speed', min: 0, max: 1 });
```
<a name="FolderHandler+addItem"></a>

### folderHandler.addItem(arg1, [arg2], [arg3]) ⇒ [<code>ItemHandler</code>](#ItemHandler)
Add a control item to this folder. Same signatures as `tab.addItem`:**Signature 1 – config object:** `folder.addItem({ type, label, ... })`**Signature 2 – bound object property:** `folder.addItem(object, propertyName, { type, label, ... })`

**Kind**: instance method of [<code>FolderHandler</code>](#FolderHandler)  

| Param | Type | Description |
| --- | --- | --- |
| arg1 | <code>object</code> \| <code>any</code> | Item config object **or** the object to bind. |
| [arg2] | <code>string</code> | Property name on `arg1` (signature 2 only). |
| [arg3] | <code>object</code> | Item config overrides (signature 2 only). |

<a name="FolderHandler+removeItem"></a>

### folderHandler.removeItem(item)
Remove an item from this folder.

**Kind**: instance method of [<code>FolderHandler</code>](#FolderHandler)  

| Param | Type | Description |
| --- | --- | --- |
| item | [<code>ItemHandler</code>](#ItemHandler) | The handler returned by `addItem`. |

<a name="ItemHandler"></a>

## ItemHandler
Handle returned by `tab.addItem()`. Use it to react to valuechanges and, for select controls, to update the options list at runtime.

**Kind**: global class  

* [ItemHandler](#ItemHandler)
    * [new ItemHandler()](#new_ItemHandler_new)
    * [.onChange(callback)](#ItemHandler+onChange) ⇒ [<code>ItemHandler</code>](#ItemHandler)
    * [.listen()](#ItemHandler+listen) ⇒ [<code>ItemHandler</code>](#ItemHandler)
    * [.updateOptions(newOptions)](#ItemHandler+updateOptions) ⇒ [<code>ItemHandler</code>](#ItemHandler)

<a name="new_ItemHandler_new"></a>

### new ItemHandler()
**Example**  
```js
const vol = tab.addItem({ type: 'slider', label: 'Volume', min: 0, max: 1 });vol.onChange(v => console.log('volume changed to', v));// Update a select's options later:const mode = tab.addItem({ type: 'select', label: 'Mode', options: ['A', 'B'] });mode.updateOptions(['A', 'B', 'C']);
```
<a name="ItemHandler+onChange"></a>

### itemHandler.onChange(callback) ⇒ [<code>ItemHandler</code>](#ItemHandler)
Register a callback that fires whenever the control's value changes.For sliders this fires on commit (pointer-up / Enter), not on every drag frame.

**Kind**: instance method of [<code>ItemHandler</code>](#ItemHandler)  
**Returns**: [<code>ItemHandler</code>](#ItemHandler) - `this` for chaining.  

| Param | Type | Description |
| --- | --- | --- |
| callback | <code>function</code> | Called with `(value)`. |

<a name="ItemHandler+listen"></a>

### itemHandler.listen() ⇒ [<code>ItemHandler</code>](#ItemHandler)
Mark this item as "listening" so that `menu.sync()` will read its boundobject property and push the value back into the menu.

**Kind**: instance method of [<code>ItemHandler</code>](#ItemHandler)  
**Returns**: [<code>ItemHandler</code>](#ItemHandler) - `this` for chaining.  
<a name="ItemHandler+updateOptions"></a>

### itemHandler.updateOptions(newOptions) ⇒ [<code>ItemHandler</code>](#ItemHandler)
Replace the options list of a select control without unmounting it.

**Kind**: instance method of [<code>ItemHandler</code>](#ItemHandler)  
**Returns**: [<code>ItemHandler</code>](#ItemHandler) - `this` for chaining.  

| Param | Type | Description |
| --- | --- | --- |
| newOptions | <code>Array</code> \| <code>object</code> | New options array or `{ key: label }` map. |

<a name="protocolVersion"></a>

## protocolVersion : <code>string</code>
Protocol/contract version this DynamicMenu build speaks. The samevalue is stamped onto every `getMenuState()` snapshot as `version`,and CanvasRenderer validates it on `setState()`. See `protocol.js`.

**Kind**: global variable  
<a name="createMenu"></a>

## createMenu(menuContainer, [options]) ⇒ [<code>Promise.&lt;MenuAPI&gt;</code>](#MenuAPI)
Mount a DynamicMenu into a DOM container and return its API.

**Kind**: global function  
**Returns**: [<code>Promise.&lt;MenuAPI&gt;</code>](#MenuAPI) - Resolves once the React component is mounted and the API is ready.  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| menuContainer | <code>HTMLElement</code> |  | DOM element where the menu will be rendered. |
| [options] | <code>object</code> | <code>{}</code> | Optional configuration. |
| [options.enableTweening] | <code>boolean</code> | <code>false</code> | Enable slider tween animation by default. |
| [options.onUiChange] | <code>function</code> | <code></code> | Initial callback fired on any UI change.   Receives `{ tabIndex, itemIndex, type, value }`. Can be replaced later via `menu.onUiChange(cb)`. |
| [options.notifyOnMount] | <code>boolean</code> | <code>false</code> | If true, fires `onUiChange` immediately   after mount with the current state of every control. |
| [options.collapsibleFolders] | <code>boolean</code> | <code>true</code> | If true, folders created with   `tab.addFolder()` can be collapsed/expanded by clicking their header. If false, folders   are static visual groups (always open, non-interactive header) — avoids canvas resizes. |
| [options.focusNavigation] | <code>boolean</code> | <code>false</code> | If true, enables device-agnostic   focus navigation (`moveUp/moveDown/moveLeft/moveRight/activate`) so the menu can be driven   by a D-pad, gamepad, VR joystick or keyboard via method calls — no hardware binding. |

**Example**  
```js
const menu = await createMenu(document.getElementById('menu-root'));const settingsTab = menu.addTab('Settings', 'fa-cog');const volumeItem  = settingsTab.addItem({ type: 'slider', label: 'Volume', min: 0, max: 1 });volumeItem.onChange(v => console.log('volume:', v));
```
<a name="addTab"></a>

## addTab(tabName, [icon]) ⇒ [<code>TabHandler</code>](#TabHandler)
Add a new tab to the menu.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| tabName | <code>string</code> | Display label for the tab. |
| [icon] | <code>string</code> | FontAwesome class (e.g. `'fa-cog'`) or raw Unicode glyph. |

<a name="removeTab"></a>

## removeTab(tab)
Remove a tab previously created with `addTab`.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| tab | [<code>TabHandler</code>](#TabHandler) | The handler returned by `addTab`. |

<a name="sync"></a>

## sync()
Re-read all bound objects and push their current values to the menu.Call this after external code changes a bound property without goingthrough the menu API.

**Kind**: global function  
<a name="isFocusNavEnabled"></a>

## isFocusNavEnabled() ⇒ <code>boolean</code>
Whether device-agnostic focus navigation is enabled (set via the`focusNavigation` option). When false, all `move*`/`activate` callsare no-ops. Use this to decide whether to show a D-pad / wire input.

**Kind**: global function  
<a name="moveUp"></a>

## moveUp()
Move keyboard/gamepad focus one row up.

**Kind**: global function  
<a name="moveDown"></a>

## moveDown()
Move keyboard/gamepad focus one row down.

**Kind**: global function  
<a name="moveLeft"></a>

## moveLeft()
Move focus left (e.g. previous button in a button row, previous tree option).

**Kind**: global function  
<a name="moveRight"></a>

## moveRight()
Move focus right.

**Kind**: global function  
<a name="clickFocusedButton"></a>

## clickFocusedButton() ⇒ <code>Object</code>
Click the button targeted inside the focused action row.
Does nothing when focus is not currently on a button control.

**Kind**: global function  
<a name="activate"></a>

## activate()
Activate the currently focused control.For buttons this fires the action; for switches it toggles; for sliders itcommits the in-flight value.

**Kind**: global function  
<a name="press"></a>

## press(direction)
Press-and-hold a direction. Fires the matching action once immediatelyand then auto-repeats while held — e.g. holding `'left'`/`'right'` over aslider ramps its value gradually. Always pair with [release](#release).`'activate'` fires once and does not repeat.Wire this to a button's pointerdown / a key's keydown / a VR trigger press.

**Kind**: global function  

| Param | Type |
| --- | --- |
| direction | <code>&#x27;up&#x27;</code> \| <code>&#x27;down&#x27;</code> \| <code>&#x27;left&#x27;</code> \| <code>&#x27;right&#x27;</code> \| <code>&#x27;activate&#x27;</code> | 

<a name="release"></a>

## release(direction)
Release a previously [press](#press)ed direction, stopping its auto-repeat.Wire to pointerup / pointerleave / keyup / VR trigger release.

**Kind**: global function  

| Param | Type |
| --- | --- |
| direction | <code>&#x27;up&#x27;</code> \| <code>&#x27;down&#x27;</code> \| <code>&#x27;left&#x27;</code> \| <code>&#x27;right&#x27;</code> \| <code>&#x27;activate&#x27;</code> | 

<a name="beginFocusedValueAdjustment"></a>

## beginFocusedValueAdjustment()
Start a continuous adjustment session on the focused slider.

**Kind**: global function  
<a name="adjustFocusedValue"></a>

## adjustFocusedValue(normalizedDelta) ⇒ <code>boolean</code>
Adjust the captured slider by a fraction of its complete range.

**Kind**: global function  
**Returns**: <code>boolean</code> - Whether the visible slider value changed.  

| Param | Type | Description |
| --- | --- | --- |
| normalizedDelta | <code>number</code> | Signed fraction of the slider range. |

<a name="endFocusedValueAdjustment"></a>

## endFocusedValueAdjustment()
Finish the active continuous adjustment session and commit its value.

**Kind**: global function  
<a name="deactivateFocusNavigation"></a>

## deactivateFocusNavigation()
Hide and reset the focus-navigation cursor. The next moveDown call
reactivates it on the current tab in the top bar.

**Kind**: global function  
<a name="setVisible"></a>

## setVisible(visible)
Show or hide the menu panel.

**Kind**: global function  

| Param | Type |
| --- | --- |
| visible | <code>boolean</code> | 

<a name="updateSelectOptions"></a>

## updateSelectOptions(target, [newOptionsOrItemIndex], [newOptions])
Update the options list of a select control at runtime.Accepts three calling signatures:- `updateSelectOptions(itemHandler, newOptions)`- `updateSelectOptions({ tabIndex, itemIndex }, newOptions)`- `updateSelectOptions(tabIndex, itemIndex, newOptions)`

**Kind**: global function  

| Param | Type |
| --- | --- |
| target | [<code>ItemHandler</code>](#ItemHandler) \| <code>Object</code> \| <code>number</code> | 
| [newOptionsOrItemIndex] | <code>Array</code> \| <code>object</code> | 
| [newOptions] | <code>Array</code> \| <code>object</code> | 

<a name="onUiChange"></a>

## onUiChange(cb)
Replace the UI-change callback. Pass `null` to disable.The callback receives `{ tabIndex, itemIndex, type, value }`.

**Kind**: global function  

| Param | Type |
| --- | --- |
| cb | <code>function</code> \| <code>null</code> | 

<a name="getMenuState"></a>

## getMenuState() ⇒ <code>object</code>
Return a serializable snapshot of the full menu state.Pass this to `CanvasRenderer.setState()` to initialize the renderer.

**Kind**: global function  
**Returns**: <code>object</code> - Menu state snapshot.  
<a name="getVisibleTabState"></a>

## getVisibleTabState() ⇒ <code>object</code>
Return a snapshot of only the currently visible tab's items.

**Kind**: global function  
<a name="subscribe"></a>

## subscribe(listener)
Subscribe to menu events (used internally by `CanvasRenderer`).The listener is called with an event object:`{ type: 'tabChange'|'structureChange'|'controlChange'|'controlCommit'|'visibilityChange', ... }`

**Kind**: global function  

| Param | Type |
| --- | --- |
| listener | <code>function</code> | 

<a name="unsubscribe"></a>

## unsubscribe(listener)
Remove a previously registered listener.

**Kind**: global function  

| Param | Type |
| --- | --- |
| listener | <code>function</code> | 

<a name="executeCommand"></a>

## executeCommand(cmd)
Execute a logical command — the same command objects emitted by`CanvasRenderer.onCommand`. Use this to wire canvas pointerinteractions back into the DynamicMenu state.Supported commands:- `{ type: 'set-tab', tabId }`- `{ type: 'cycle', tabId, itemId, payload: { direction: 'prev'|'next' } }`- `{ type: 'toggle', tabId, itemId }`- `{ type: 'toggle-folder', tabId, itemId }`- `{ type: 'activate', tabId, itemId, payload: { buttonIndex, buttonLabel } }`- `{ type: 'set-slider-raw', tabId, itemId, payload: { rawValue } }`- `{ type: 'set-value', tabId, itemId, payload: { value } }`

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| cmd | <code>object</code> | Command object. |

<a name="setCurrentTab"></a>

## setCurrentTab(tabId)
Programmatically switch to a tab by its ID.

**Kind**: global function  

| Param | Type |
| --- | --- |
| tabId | <code>string</code> | 

<a name="MenuAPI"></a>

## MenuAPI : <code>object</code>
The public interface returned by [createMenu](#createMenu).

**Kind**: global typedef  
