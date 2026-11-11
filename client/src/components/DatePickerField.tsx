import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
};

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const isoDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const displayDate = (value: string) => {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
};

export default function DatePickerField({
  value,
  onChange,
  ariaLabel,
  placeholder = "Seleccionar fecha",
}: Props) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() =>
    value ? new Date(`${value}T00:00:00`) : new Date()
  );
  const wrapperRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (open && value) setCursor(new Date(`${value}T00:00:00`));
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthLabel = `${MONTHS[month]} ${year}`;
  const today = new Date();
  const todayIso = isoDate(today);
  const cells = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const offset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return [
      ...Array.from({ length: offset }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
    ];
  }, [year, month]);

  const choose = (date: Date) => {
    onChange(isoDate(date));
    setOpen(false);
  };

  return (
    <span className="date-picker-field" ref={wrapperRef}>
      <button
        type="button"
        className="session-date-trigger"
        onClick={() => setOpen(value => !value)}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <CalendarDays size={16} />
        <span className={value ? "" : "date-placeholder"}>
          {value ? displayDate(value) : placeholder}
        </span>
        <ChevronRight
          size={14}
          className={open ? "date-trigger-chevron open" : "date-trigger-chevron"}
        />
      </button>
      {open && (
        <div
          className="date-picker-popover"
          role="dialog"
          aria-label={ariaLabel}
        >
          <div className="date-picker-head">
            <button
              type="button"
              className="date-picker-nav"
              onClick={() => setCursor(new Date(year, month - 1, 1))}
              aria-label="Mes anterior"
            >
              <ChevronLeft size={17} />
            </button>
            <b>{monthLabel}</b>
            <button
              type="button"
              className="date-picker-nav"
              onClick={() => setCursor(new Date(year, month + 1, 1))}
              aria-label="Mes siguiente"
            >
              <ChevronRight size={17} />
            </button>
          </div>
          <div className="date-picker-weekdays">
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(day => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="date-picker-grid">
            {cells.map((day, index) => {
              if (day === null) return <span key={`empty-${index}`} />;
              const date = new Date(year, month, day);
              const iso = isoDate(date);
              return (
                <button
                  type="button"
                  key={iso}
                  className={`date-picker-day ${iso === todayIso ? "today" : ""} ${iso === value ? "selected" : ""}`}
                  onClick={() => choose(date)}
                  aria-label={`${day} de ${MONTHS[month]} de ${year}`}
                  aria-pressed={iso === value}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <div className="date-picker-footer">
            <button type="button" onClick={() => choose(new Date())}>
              Hoy
            </button>
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Borrar
            </button>
          </div>
        </div>
      )}
    </span>
  );
}
