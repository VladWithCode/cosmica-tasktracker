import { Check } from "lucide-react";
import type { SharingAccessLevel } from "@/api/schemas";
import { GroupedRow, GroupedSection } from "@/components/ui/GroupedList";
import { accessLevelInfo, accessLevelOrder } from "./accessLevels";

export function AccessLevelPicker({ value, onChange }: { value: SharingAccessLevel; onChange: (level: SharingAccessLevel) => void }) {
    return (
        <GroupedSection title="Qué puede hacer">
            <div role="radiogroup" aria-label="Nivel de acceso">
                {accessLevelOrder.map((level) => (
                    <div key={level} className="[&+&]:border-t [&+&]:border-separator">
                        <GroupedRow
                            onPress={() => onChange(level)}
                            label={
                                <span className="flex flex-col">
                                    <span>{accessLevelInfo[level].label}</span>
                                    <span className="text-footnote whitespace-normal text-label-secondary">{accessLevelInfo[level].description}</span>
                                </span>
                            }
                            trailing={value === level ? <Check aria-label="Seleccionado" className="size-5 text-accent" strokeWidth={2.5} /> : null}
                        />
                    </div>
                ))}
            </div>
        </GroupedSection>
    );
}
