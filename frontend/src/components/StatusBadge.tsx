import { badgeClass } from "../utils/colors";

export function StatusBadge({ name, category }: { name: string; category: string | null }) {
  return <span className={badgeClass(category)}>{name}</span>;
}
