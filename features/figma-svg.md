/**
 * Hướng dẫn tạo phần tử SVG trong Figma thông qua SDK
 * Sử dụng figma.createNodeFromSvg(svgString)
 */

async function createSvgElement() {
  // 1. Chuẩn bị chuỗi mã nguồn SVG (SVG String)
  // Lưu ý: SVG nên có viewBox để đảm bảo tỷ lệ chính xác
  const svgString = `
    <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="40" stroke="#FF5500" stroke-width="5" />
      <path d="M30 50L45 65L70 35" stroke="#FF5500" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;

  try {
    // 2. Tạo Node từ chuỗi SVG
    // Phương thức này sẽ trả về một FrameNode chứa các vector bên trong
    const svgNode = figma.createNodeFromSvg(svgString);
    
    // 3. Đặt tên và vị trí cho node
    svgNode.name = "My Created SVG";
    svgNode.x = figma.viewport.center.x;
    svgNode.y = figma.viewport.center.y;

    // 4. Thay đổi kích thước (nếu cần)
    // SVG khi import vào thường được bọc trong một Frame
    svgNode.resize(200, 200); 

    // 5. Nếu bạn muốn thay đổi màu sắc của các lớp bên trong SVG
    // Chúng ta cần duyệt qua các con (children) của Frame đó
    const findAndRecolor = (node) => {
      if ("fills" in node) {
        const fills = JSON.parse(JSON.stringify(node.fills));
        // Ví dụ: Đổi tất cả sang màu xanh Blue (RGB 0-1)
        if (fills.length > 0 && fills[0].type === 'SOLID') {
          fills[0].color = { r: 0.1, g: 0.5, b: 0.9 };
          node.fills = fills;
        }
      }
      if ("children" in node) {
        node.children.forEach(findAndRecolor);
      }
    };
    
    // findAndRecolor(svgNode); // Bỏ comment nếu muốn đổi màu động

    // 6. Focus vào đối tượng vừa tạo
    figma.currentPage.appendChild(svgNode);
    figma.viewport.scrollAndZoomIntoView([svgNode]);

    console.log("SVG created successfully!");
  } catch (error) {
    console.error("Error creating SVG:", error);
  }
}

/**
 * LƯU Ý QUAN TRỌNG:
 * 1. figma.createNodeFromSvg() trả về một FrameNode.
 * 2. Các phần tử bên trong SVG (path, circle, rect) sẽ trở thành VectorNode hoặc GroupNode.
 * 3. Nếu chuỗi SVG bị lỗi cú pháp, hàm sẽ ném ra (throw) một error.
 * 4. Để giữ nguyên tỷ lệ khi resize, hãy đảm bảo SVG gốc có thuộc tính viewBox.
 */