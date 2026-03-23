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
Layout --> dimensions has option: 
+ W with [fixed width,hug content, fill container]
+ H with [fixed height,hug content, fill container]


###
refactor layot attribute:
LAYOUT
Row1:
resizing: [auto width, auto height, fixed sized] (switcher)

Row2: always show width & height

Choose auto width or auto height:
+ Resizing label

Choose auto width
==> width and height is both Hug content (can be edit)
W - Hug content
H - Hug content

Choose auto height:
==> only fixed width, height is hug content (can be edit)

Choose fixed sized:
+ Dimensions label: fixed sized. (allow fixed width or height, fill container with width or height)


if after edit, can change to other resizing.

###
html to Penma
<span class="_badge_1smf8_78 _connected_1smf8_87">연동됨</span>
._badge_1smf8_78 {
    display: inline-flex;
    align-items: center;
    padding: 3px 8px;
    border-radius: 20px;
    font-size: .75rem;
    font-weight: 500;
}

span text is layout "auto width"


###
refactor Element support:
review example:
<a class="_navItem_7n7c0_271 " href="/campaigns" data-discover="true"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 5.5h2.3L11 2v12l-6.2-3.5H2.5A1 1 0 011.5 9.5v-3a1 1 0 011-1z"></path><path d="M4.8 10.5v3"></path><path d="M12.5 5.5c1 .7 1.5 1.8 1.5 2.5s-.5 1.8-1.5 2.5"></path></svg> 내 캠페인<span class="_countBadge_7n7c0_308">3</span></a>
._navItem_7n7c0_271 {
    color: var(--text-sub);
}

._countBadge_7n7c0_308 {
    background: #f07585;
    color: #fff;
}

내 캠페인 will use color "Fill" from a._navItem_7n7c0_271 , and _countBadge_7n7c0_308 use this color background and text

##
refactor import layout.
example html:
<table class="_recentTable_lr8cs_118"><thead><tr><th>캠페인명</th><th>플랫폼</th><th>상태</th><th>CTR</th><th>지출</th></tr></thead><tbody><tr><td><a class="_campName_lr8cs_148" href="/campaigns/1" data-discover="true">Summer Sale 2024</a></td><td class="_sub_lr8cs_177">Google Ads</td><td><span class="_badge_bsib0_1 _active_bsib0_10">운영중</span></td><td class="num">3.8%</td><td class="num">₩840K</td></tr><tr><td><a class="_campName_lr8cs_148" href="/campaigns/2" data-discover="true">test creative</a></td><td class="_sub_lr8cs_177">Google Ads</td><td><span class="_badge_bsib0_1 _active_bsib0_10">운영중</span></td><td class="num">4.0%</td><td class="num">₩560K</td></tr><tr><td><a class="_campName_lr8cs_148" href="/campaigns/3" data-discover="true">Felix display 16/2</a></td><td class="_sub_lr8cs_177">LinkedIn</td><td><span class="_badge_bsib0_1 _paused_bsib0_14">일시정지</span></td><td class="num">3.5%</td><td class="num">₩490K</td></tr><tr><td><a class="_campName_lr8cs_148" href="/campaigns/4" data-discover="true">Campaign Kakao</a></td><td class="_sub_lr8cs_177">카카오</td><td><span class="_badge_bsib0_1 _paused_bsib0_14">일시정지</span></td><td class="num">3.1%</td><td class="num">₩310K</td></tr></tbody></table>

tr {
    display: table-row;
    vertical-align: inherit;
    unicode-bidi: isolate;
    border-color: inherit;
}

tr (display: table-row;) --> is auto layout use direction horizontal


##
refactor import layout.
example html:
<tbody><tr><td><a class="_campName_lr8cs_148" href="/campaigns/1" data-discover="true">Summer Sale 2024</a></td><td class="_sub_lr8cs_177">Google Ads</td><td><span class="_badge_bsib0_1 _active_bsib0_10">운영중</span></td><td class="num">3.8%</td><td class="num">₩840K</td></tr><tr><td><a class="_campName_lr8cs_148" href="/campaigns/2" data-discover="true">test creative</a></td><td class="_sub_lr8cs_177">Google Ads</td><td><span class="_badge_bsib0_1 _active_bsib0_10">운영중</span></td><td class="num">4.0%</td><td class="num">₩560K</td></tr><tr><td><a class="_campName_lr8cs_148" href="/campaigns/3" data-discover="true">Felix display 16/2</a></td><td class="_sub_lr8cs_177">LinkedIn</td><td><span class="_badge_bsib0_1 _paused_bsib0_14">일시정지</span></td><td class="num">3.5%</td><td class="num">₩490K</td></tr><tr><td><a class="_campName_lr8cs_148" href="/campaigns/4" data-discover="true">Campaign Kakao</a></td><td class="_sub_lr8cs_177">카카오</td><td><span class="_badge_bsib0_1 _paused_bsib0_14">일시정지</span></td><td class="num">3.1%</td><td class="num">₩310K</td></tr></tbody>

tbody {
    display: table-row-group;
    vertical-align: middle;
    unicode-bidi: isolate;
    border-color: inherit;
}

._recentTable_lr8cs_118 td {
    padding: 13px 20px;
    font-size: .8125rem;
    border-bottom: 1px solid var(--border);
}

Learning data and display suitable
