import { Timestamp } from 'firebase/firestore';

export interface Discussion {
    id: string;
    title: string;
    content: string;
    userId: string;
    userName: string;
    timestamp: Timestamp;
}

export interface Announcement {
    id: string;
    title: string;
    content: string;
    timestamp: Timestamp;
}

export interface Resource {
    id: string;
    unit: string;
    type: 'past-papers' | 'learning-materials' | 'objectives' | 'achievement';
    title: string;
    data: string; // URL or Text Content
    uploadedBy: string;
    timestamp: Timestamp;
}

export const UNIT_MAP: Record<string, string> = {
    'biochemistry': '1. Biochemistry',
    'physiology': '2. Physiology',
    'anatomy-general': '3A. General Anatomy',
    'anatomy-embryology': '3B. Embryology (Anatomy)',
    'anatomy-histology': '3C. Histology (Anatomy)',
    'nursing-skills': '4. Nursing Skills'
};

export const RESOURCE_TYPE_MAP: Record<string, string> = {
    'objectives': 'Learning Objectives',
    'past-papers': 'Past Papers',
    'learning-materials': 'Learning Materials (Links)',
    'achievement': 'Achievement & Milestones'
};