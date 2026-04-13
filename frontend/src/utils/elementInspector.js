export const createElementInspectorScript = () => {
  return `
    (() => {
      console.log('[Inspector] ✓ SCRIPT LOADED IN IFRAME - Ready to detect clicks');
      let selectedElement = null;
      let overlay = null;
      let label = null;
      let inspectorActive = false;

      // Utility: remove old overlays
      function clearHighlight() {
        if (overlay) overlay.remove();
        if (label) label.remove();
        overlay = null;
        label = null;

        document.querySelectorAll('[data-inspector-overlay], [data-inspector-label]').forEach((node) => {
          node.remove();
        });

        if (selectedElement) {
          selectedElement.style.outline = "";
          selectedElement.style.outlineOffset = "";
        }
      }

      // Create overlay + label without removing selectedElement
      function drawOverlay(element) {
        const rect = element.getBoundingClientRect();

        if (selectedElement && selectedElement !== element) {
          selectedElement.style.outline = "";
          selectedElement.style.outlineOffset = "";
        }

        // Only remove overlay/label, not element highlight
        if (overlay) overlay.remove();
        if (label) label.remove();

        // Highlight element itself
        element.style.outline = "2px solid #6366f1";
        element.style.outlineOffset = "2px";

        // Overlay box
        overlay = document.createElement("div");
        overlay.setAttribute("data-inspector-overlay", "");
        overlay.style.cssText = \`
          position: fixed;
          left: \${rect.left}px;
          top: \${rect.top}px;
          width: \${rect.width}px;
          height: \${rect.height}px;
          border: 2px solid #6366f1;
          background: rgba(99, 102, 241, 0.05);
          outline: 1px solid rgba(99,102,241,0.3);
          pointer-events: none;
          z-index: 999999;
        \`;

        // Label
        label = document.createElement("div");
        label.style.cssText = \`
          position: fixed;
          left: \${rect.left}px;
          top: \${Math.max(rect.top - 26, 0)}px;
          background: #6366f1;
          color: white;
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-family: monospace;
          z-index: 1000000;
          pointer-events: none;
        \`;
        label.setAttribute("data-inspector-label", "");
        label.textContent = element.tagName.toLowerCase();

        document.body.appendChild(overlay);
        document.body.appendChild(label);
      }

      // Keep overlay aligned on scroll/resize
      function syncOverlay() {
        if (!selectedElement || !overlay || !label) return;
        const rect = selectedElement.getBoundingClientRect();

        overlay.style.left = rect.left + "px";
        overlay.style.top = rect.top + "px";
        overlay.style.width = rect.width + "px";
        overlay.style.height = rect.height + "px";

        label.style.left = rect.left + "px";
        label.style.top = Math.max(rect.top - 26, 0) + "px";
      }

      window.addEventListener("scroll", syncOverlay);
      window.addEventListener("resize", syncOverlay);

      // Extract editable inline styles
      function getEditableStyles(element) {
        const style = element.style;
        return {
          color: style.color || "",
          backgroundColor: style.backgroundColor || "",
          fontSize: style.fontSize || "",
          padding: style.padding || "",
          margin: style.margin || "",
          width: style.width || "",
          height: style.height || "",
          fontFamily: style.fontFamily || "",
          fontWeight: style.fontWeight || "",
          borderRadius: style.borderRadius || "",
          opacity: style.opacity || "",
          textAlign: style.textAlign || "",
          display: style.display || "",
          border: style.border || ""
        };
      }

      // Extract computed styles
      function getComputedStyles(element) {
        const c = getComputedStyle(element);
        return {
          color: c.color,
          backgroundColor: c.backgroundColor,
          fontSize: c.fontSize,
          padding: c.padding,
          margin: c.margin,
          width: c.width,
          height: c.height,
          fontFamily: c.fontFamily,
          fontWeight: c.fontWeight,
          borderRadius: c.borderRadius,
          opacity: c.opacity,
          textAlign: c.textAlign,
          display: c.display,
          border: c.border
        };
      }

      // Click handler
      document.addEventListener(
        "click",
        (e) => {
          if (!inspectorActive) {
            console.log("[Inspector] INACTIVE");
            return;
          }

          const el = e.target;
          if (!el) return;

          const hasDataId = el.hasAttribute("data-id");

          // Only inspect elements with data-id
          if (!hasDataId) return;

          e.preventDefault();
          e.stopPropagation();

          drawOverlay(el);

          selectedElement = el;

          const dataId = el.getAttribute("data-id");

          window.parent.postMessage(
            {
              type: "ELEMENT_SELECTED",
              data: {
                dataId,
                tagName: el.tagName.toLowerCase(),
                className: el.className,
                editableStyles: getEditableStyles(el),
                computedStyles: getComputedStyles(el),
                rect: el.getBoundingClientRect()
              }
            },
            "*"
          );
        },
        true
      );

      // Apply style updates
      window.addEventListener("message", (e) => {
        if (e.data.type === "UPDATE_ELEMENT_STYLE") {
          const { dataId, styles } = e.data;
          const el = document.querySelector(\`[data-id="\${dataId}"]\`);
          if (!el) return;

          Object.entries(styles).forEach(([prop, value]) => {
            el.style[prop] = value || "";
          });

          if (el === selectedElement) {
            drawOverlay(el);
          }
        }

        // Toggle inspector
        if (e.data.type === "TOGGLE_INSPECTOR") {
          inspectorActive = e.data.active;
          if (!inspectorActive) {
            clearHighlight();
            selectedElement = null;
          }
        }

        if (e.data.type === "CLEAR_INSPECTOR_HIGHLIGHT") {
          clearHighlight();
          selectedElement = null;
        }
      });

      console.log("[Inspector] Ready");
    })();
  `;
};