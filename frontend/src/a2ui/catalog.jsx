import { Check, CarFront, ArrowRight } from "lucide-react";
import { resolvePathValue, formatMoney } from "./utils.js";

export const ROAM_CATALOG = {
  Column: ({ children, className = "a2ui-column" }) => (
    <div className={className}>{children}</div>
  ),
  Row: ({ children, className = "a2ui-row" }) => (
    <div className={className}>{children}</div>
  ),
  Text: ({ text, variant = "body", className = "" }) => {
    const classes = {
      eyebrow: "a2ui-eyebrow",
      h2: "a2ui-heading",
      body: "a2ui-body",
      confirmation: "a2ui-confirmation",
    };
    return (
      <p className={`${classes[variant] || classes.body} ${className}`.trim()}>
        {text}
      </p>
    );
  },
  Badge: ({ text, suffix = "" }) => (
    <span className="a2ui-badge">
      {text}
      {suffix}
    </span>
  ),
  ProgressBar: ({ value = 0, max = 7, label = "" }) => {
    const pct = max ? Math.round((Number(value) / Number(max)) * 100) : 0;
    return (
      <div className="a2ui-progress">
        <div className="a2ui-progress-meta">
          <span>{label}</span>
          <span>{pct}%</span>
        </div>
        <div className="a2ui-progress-track">
          <div className="a2ui-progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  },
  Spinner: ({ label = "Working…" }) => (
    <div className="a2ui-spinner-wrap">
      <div className="a2ui-spinner" />
      <span>{label}</span>
    </div>
  ),
  PreferenceGrid: ({ items = [] }) => (
    <div className="preference-grid">
      {items.map((item) => (
        <div className="preference-item" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
      {!items.length && (
        <p className="a2ui-body muted">
          Preferences will appear here as you chat.
        </p>
      )}
    </div>
  ),
  EmptyState: ({ message = "Nothing to show yet." }) => (
    <div className="empty">
      <p>{message}</p>
    </div>
  ),
  Icon: ({ name, variant = "default" }) => (
    <div className={`a2ui-icon ${variant}`}>{name === "check" ? "✓" : "•"}</div>
  ),
  TextField: ({
    name,
    label,
    type = "text",
    placeholder = "",
    required = false,
    value = "",
    onChange,
    autoComplete,
  }) => (
    <label className="a2ui-field">
      <span>{label}</span>
      <input
        name={name}
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(event) => onChange?.(name, event.target.value)}
      />
    </label>
  ),
  Button: ({ text, primary = false, onAction }) => (
    <button
      type="button"
      className={primary ? "a2ui-button primary" : "a2ui-button secondary"}
      onClick={() => onAction?.({})}
    >
      {text}
      {primary && <ArrowRight size={18} />}
    </button>
  ),
  VehicleSummary: ({ vehicle = {} }) => (
    <div className="a2ui-vehicle">
      <div className="car-image">
        <CarFront size={34} strokeWidth={1.2} />
      </div>
      <div>
        <strong>
          {vehicle.brand} {vehicle.model}
        </strong>
        <span>
          {vehicle.category} / {vehicle.fuelType} · {vehicle.seats} seats ·{" "}
          {vehicle.transmission} · {vehicle.provider}
        </span>
        <em>{vehicle.priceLine}</em>
      </div>
    </div>
  ),
  TripGrid: ({ route, dates }) => (
    <div className="preference-grid">
      <div className="preference-item">
        <span>Route</span>
        <strong>{route || "—"}</strong>
      </div>
      <div className="preference-item">
        <span>Dates</span>
        <strong>{dates || "—"}</strong>
      </div>
    </div>
  ),
  AmountRow: ({ label, amount }) => (
    <div className="a2ui-amount">
      <span>{label}</span>
      <strong>{amount}</strong>
    </div>
  ),
  CarCatalog: ({ items = [], onAction }) => (
    <div className="catalog">
      {items.map((car) => (
        <article className="car-card" key={car.listingId}>
          <div className="car-number">0{car.rank}</div>
          <div className="car-main">
            <div className="car-image">
              <CarFront size={54} strokeWidth={1.2} />
            </div>
            <div>
              <p className="car-type">{car.subtitle}</p>
              <h3>{car.title}</h3>
              <p className="meta">{car.meta}</p>
            </div>
          </div>
          <div className="score">
            <strong>{car.score}</strong>
            <span>MATCH</span>
          </div>
          <div className="reasons">
            {car.reasons?.map((reason) => (
              <span key={reason}>
                <Check size={13} />
                {reason}
              </span>
            ))}
          </div>
          <div className="price">
            {car.price}
            <button
              type="button"
              onClick={() =>
                onAction?.({
                  name: "select_car",
                  context: { listingId: car.listingId },
                })
              }
            >
              Select <ArrowRight size={14} />
            </button>
          </div>
        </article>
      ))}
    </div>
  ),
};

export function renderComponent(node, context) {
  const Component = ROAM_CATALOG[node.component];
  if (!Component) return null;

  const props = {};
  if (node.props && typeof node.props === "object") {
    for (const [key, value] of Object.entries(node.props)) {
      props[key] = resolvePathValue(value, context.dataModel);
    }
  }
  for (const [key, value] of Object.entries(node)) {
    if (
      ["id", "component", "props", "children", "child", "action"].includes(key)
    )
      continue;
    props[key] = resolvePathValue(value, context.dataModel);
  }

  if (node.component === "TextField") {
    props.onChange = context.onFieldChange;
    props.value = context.form?.[props.name] ?? props.value ?? "";
  }

  if (node.action) {
    props.onAction = (payload) =>
      context.onAction?.({
        ...node.action.event,
        ...payload,
      });
  }

  if (node.children?.length) {
    props.children = node.children.map((childId) => {
      const child = context.components.get(childId);
      return child ? (
        <div key={childId}>{renderComponent(child, context)}</div>
      ) : null;
    });
  }

  if (node.child) {
    const child = context.components.get(node.child);
    props.children = child ? renderComponent(child, context) : null;
  }

  return <Component key={node.id} {...props} />;
}

export { formatMoney };
