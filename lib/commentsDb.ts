import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export interface Comment {
  id: string;
  name: string;
  content: string;
  createdAt: string;
}

const dataFilePath = path.join(process.cwd(), 'data', 'comments.json');

// Initialize the file if it doesn't exist
async function initDb() {
  try {
    await fs.access(dataFilePath);
  } catch {
    await fs.writeFile(dataFilePath, JSON.stringify([]), 'utf-8');
  }
}

export async function getComments(): Promise<Comment[]> {
  await initDb();
  try {
    const fileData = await fs.readFile(dataFilePath, 'utf-8');
    return JSON.parse(fileData) as Comment[];
  } catch (error) {
    console.error('Error reading comments:', error);
    return [];
  }
}

export async function addComment(name: string, content: string): Promise<Comment> {
  const comments = await getComments();
  
  const newComment: Comment = {
    id: crypto.randomUUID(),
    name,
    content,
    createdAt: new Date().toISOString(),
  };
  
  comments.push(newComment);
  await fs.writeFile(dataFilePath, JSON.stringify(comments, null, 2), 'utf-8');
  return newComment;
}

export async function deleteComment(id: string): Promise<boolean> {
  const comments = await getComments();
  const initialLength = comments.length;
  const filteredComments = comments.filter(c => c.id !== id);
  
  if (filteredComments.length !== initialLength) {
    await fs.writeFile(dataFilePath, JSON.stringify(filteredComments, null, 2), 'utf-8');
    return true;
  }
  return false;
}
