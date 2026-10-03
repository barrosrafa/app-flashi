export type FieldType = 'text' | 'image' | 'audio' | 'cloze';
export interface FieldDefinition { name: string; type?: FieldType; required?: boolean; [key: string]: unknown; }
export interface CardGenerationRule { name?: string; front: string; back: string; [key: string]: unknown; }
export interface CardTemplate { id: string; user_id: string | null; name: string; field_definitions: FieldDefinition[]; card_generation: CardGenerationRule[]; is_system: boolean; created_at: string; updated_at?: string; usn?: number; }
