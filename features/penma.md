# rule
###
if div is only flex: 1 ==> auto layout veritcal
._content_lr8cs_1 {
    flex: 1;
    overflow-y: auto;
    padding: 28px 32px;
}

###
export figma json:
marginBottom is missing.

###
if div
._grid_1smf8_35 {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0;
}
use auto layout is grid and format grid-template-columns

###
If a div has no flex or grid,
and contains multiple elements,
the default is auto-layout vertical.

###
._cardHeader_1smf8_12 {
    padding: 14px 18px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
}
when import, also support border

###
html
<button class="_btn_1smf8_113">Create Campaign</button>
=> penma: Component > Text (2 element)
ajust Component is auto layout: alignment center, no padding

###
<button class="_btn_1smf8_113">캠페인 만들기</button>
._btn_1smf8_113 {
    width: 100%;
    padding: 7px 0;
    border-radius: 8px;
    font-size: .75rem;
    font-weight: 700;
    font-family: inherit;
    text-align: center;
    cursor: pointer;
    border: none;
    background: var(--text-link);
    color: #fff;
    transition: background .15s, color .15s;
}

==> Padding does not affect the text inside. refactor at @cod

##
refactor convert html to penma
<button class="_btn_1smf8_113">캠페인 만들기</button>
._btn_1smf8_113 {
    width: 100%;
    padding: 7px 0;
    border-radius: 8px;
    font-size: .75rem;
    font-weight: 700;
    font-family: inherit;
    text-align: center;
    cursor: pointer;
    border: none;
    background: var(--text-link);
    color: #fff;
    transition: background .15s, color .15s;
}
==>
+ button -> Component/Button & attr of class _btn_1smf8_113
+ 캠페인 만들기 is a text element.

text element don't support spacing, only support "Alignment"
Align: left, center, right
Align top, middle, bottom


##
convert web url to penma
pattern:
<span class="_badge_1smf8_78 _connected_1smf8_87">연동됨</span>
._badge_1smf8_78 {
    display: inline-flex;
    align-items: center;
    padding: 3px 8px;
    border-radius: 20px;
    font-size: .75rem;
    font-weight: 500;
}

==> penga
+ div
+ 연동됨 is a text element.
final result penma like concept <div class="_badge_1smf8_78 _connected_1smf8_87"><span>연동됨</span><div>

##
Layout --> resizing: auto width, auto height, fixed size
Layout --> dimensions: 
+ W: fixed width,hug content, fill container. 
+ H: fixed height,hug content, fill container.