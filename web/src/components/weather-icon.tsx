import { Cloud, CloudLightning, CloudRain, CloudSun, Sun } from "lucide-react";
import type { WeatherCondition } from "@/lib/mock-data";

const ICONS = {
  sun: { Icon: Sun, className: "text-banana-500", label: "Sunny" },
  partly: { Icon: CloudSun, className: "text-banana-500", label: "Partly cloudy" },
  cloud: { Icon: Cloud, className: "text-muted", label: "Cloudy" },
  rain: { Icon: CloudRain, className: "text-sky-600", label: "Rain" },
  storm: { Icon: CloudLightning, className: "text-indigo-600", label: "Thunderstorm" },
};

export function WeatherIcon({ condition, className = "size-6" }: { condition: WeatherCondition; className?: string }) {
  const { Icon, className: tone, label } = ICONS[condition];
  return <Icon className={`${className} ${tone}`} aria-label={label} />;
}
