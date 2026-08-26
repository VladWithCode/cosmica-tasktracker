export interface Note {
    id: string;
    user_id: string;
    content: string;
    created_at: string;
    updated_at: string;
}

/** Note count for a single local calendar day. */
export interface NoteHistoryDay {
    date: string;
    total: number;
}

export interface NoteHistoryRange {
    from: string;
    to: string;
    days: NoteHistoryDay[];
}
