import { useCallback, useMemo, useState } from "react";
import { renderComponent } from "./catalog.jsx";

const MESSAGE_TYPES = [
  "createSurface",
  "updateComponents",
  "updateDataModel",
  "deleteSurface",
];

const toArray = (value) =>
  Array.isArray(value) ? value : value ? [value] : [];

function setAtPath(target, path, value) {
  if (!path || path === "/") return value;
  const parts = String(path)
    .replace(/^\$\./, "")
    .replace(/^\//, "")
    .split(/[./]/)
    .filter(Boolean);
  if (!parts.length) return value;
  const clone = { ...(target || {}) };
  let cursor = clone;
  for (let index = 0; index < parts.length - 1; index += 1) {
    cursor[parts[index]] = { ...(cursor[parts[index]] || {}) };
    cursor = cursor[parts[index]];
  }
  cursor[parts[parts.length - 1]] = value;
  return clone;
}

function reduceEvents(events) {
  const surfaces = {};
  for (const envelope of toArray(events)) {
    if (!envelope || typeof envelope !== "object") continue;
    const type = MESSAGE_TYPES.find((key) => envelope[key] != null);
    const event = type ? envelope[type] : envelope.type ? envelope : null;
    if (!event) continue;
    const surfaceId = event.surfaceId;
    if (type === "createSurface") {
      surfaces[surfaceId] = {
        dataModel: {},
        components: new Map(),
        surface: event,
      };
    } else if (type === "updateComponents") {
      if (!surfaces[surfaceId])
        surfaces[surfaceId] = {
          dataModel: {},
          components: new Map(),
          surface: { surfaceId },
        };
      const components = new Map();
      for (const node of event.components || []) components.set(node.id, node);
      surfaces[surfaceId] = { ...surfaces[surfaceId], components };
    } else if (type === "updateDataModel") {
      if (!surfaces[surfaceId])
        surfaces[surfaceId] = {
          dataModel: {},
          components: new Map(),
          surface: { surfaceId },
        };
      surfaces[surfaceId].dataModel = setAtPath(
        surfaces[surfaceId].dataModel,
        event.path,
        event.value,
      );
    } else if (type === "deleteSurface") {
      delete surfaces[surfaceId];
    }
  }
  return surfaces;
}

function findRoot(surface) {
  if (!surface?.components?.size) return null;
  return (
    surface.components.get("root") || surface.components.values().next().value
  );
}

export function A2UIRenderer({ events, onAction, className = "" }) {
  const surfaces = useMemo(() => reduceEvents(events), [events]);
  const [formValues, setFormValues] = useState({});

  const handleFieldChange = useCallback((surfaceId, name, value) => {
    setFormValues((current) => ({
      ...current,
      [surfaceId]: { ...(current[surfaceId] || {}), [name]: value },
    }));
  }, []);

  const handleAction = useCallback(
    (surfaceId, payload) => {
      if (payload?.name === "submit_booking") {
        onAction?.({
          name: "submit_booking",
          data: formValues[surfaceId] || {},
        });
        return;
      }
      onAction?.(payload);
    },
    [formValues, onAction],
  );

  return (
    <div className={`a2ui-surfaces ${className}`.trim()}>
      {Object.entries(surfaces).map(([surfaceId, surface]) => {
        const root = findRoot(surface);
        if (!root) return null;
        return (
          <div className="a2ui-surface" key={surfaceId}>
            {renderComponent(root, {
              dataModel: surface.dataModel,
              components: surface.components,
              form: formValues[surfaceId] || {},
              onAction: (payload) => handleAction(surfaceId, payload),
              onFieldChange: (name, value) =>
                handleFieldChange(surfaceId, name, value),
            })}
          </div>
        );
      })}
    </div>
  );
}
