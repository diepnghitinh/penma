# Rules
1. Refactor import json to Figma:
- Penma: width 
    --> 
    Figma: Auto layout -> Resizing

2. Penma: has margin Bottom
    -->
    Figma: missing margin bottom. (fix it)

3. Penma: Component/Button & attributes
    --> 
    Figma: create a Container use: Auto layout

4. Penma: Component/Button & attributes
    Text in Component
    --> 
    Figma: create a Container use: Auto layout

5.
penma: span text-valign ==> figma: Alignment (top, middle, bottom)

6. Figma json:
{"id":"8df66731-520b-4f18-be81-d0e2e7ea6454","name":"._badge_1smf8_78","type":"FRAME","visible":true,"locked":false,"absoluteBoundingBox":{"x":2606.375,"y":160,"width":49.125,"height":23},"constraints":{"vertical":"TOP","horizontal":"LEFT"},"fills":[{"type":"SOLID","visible":true,"color":{"r":0.08627450980392157,"g":0.6392156862745098,"b":0.2901960784313726,"a":1}}],"cornerRadius":20,"layoutMode":"HORIZONTAL","primaryAxisSizingMode":"FIXED","counterAxisSizingMode":"FIXED","primaryAxisAlignItems":"CENTER","counterAxisAlignItems":"CENTER","paddingTop":3,"paddingRight":8,"paddingBottom":3,"paddingLeft":8,"itemSpacing":0,"clipsContent":true,"layoutSizingHorizontal":"FIXED","layoutSizingVertical":"FIXED","layoutGrow":0,"layoutAlign":"INHERIT","children":[{"id":"903e0d00-428f-4615-8e90-6b62bb434098","name":"span","type":"TEXT","visible":true,"locked":false,"absoluteBoundingBox":{"x":2606.375,"y":160,"width":49.125,"height":23},"constraints":{"vertical":"TOP","horizontal":"LEFT"},"fills":[{"type":"SOLID","visible":true,"color":{"r":1,"g":1,"b":1,"a":1}}],"characters":"연동됨","textAlignHorizontal":"LEFT","textAlignVertical":"CENTER","style":{"fontFamily":"Plus Jakarta Sans","fontSize":12,"fontWeight":500,"letterSpacing":0,"textDecoration":"NONE"},"layoutSizingHorizontal":"HUG","layoutSizingVertical":"HUG","layoutGrow":0,"layoutAlign":"INHERIT"}]}

Render to Figma element keep for span text element
layoutSizingVertical 
layoutSizingHorizontal

7.
import
penma: position is absolute
==>
figma: position X & Y

 const cssPosition = styles['position'];
  const isAbsolutePositioned = cssPosition === 'absolute' || cssPosition === 'fixed';
  if (isAbsolutePositioned) {
    result.layoutPositioning = 'ABSOLUTE';
  }