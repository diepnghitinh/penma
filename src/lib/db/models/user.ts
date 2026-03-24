import mongoose, { Schema, type Document } from 'mongoose';
import crypto from 'crypto';

export interface IUser extends Document {
  username: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema(
  {
    username: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

if (mongoose.models.User) {
  mongoose.deleteModel('User');
}

export const User = mongoose.model<IUser>('User', UserSchema);

/** Hash a password with SHA-256 + salt */
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(s + password).digest('hex');
  return { hash: `${s}:${hash}`, salt: s };
}

/** Verify a password against a stored hash */
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const check = crypto.createHash('sha256').update(salt + password).digest('hex');
  return check === hash;
}
