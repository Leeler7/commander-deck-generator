// Database factory to switch between file-based and Supabase databases
import { database as supabaseDb } from './supabase-updated';

export type DatabaseType = 'file' | 'supabase';

export interface DatabaseInterface {
  searchByName(query: string, limit?: number): Promise<any[]>;
  getCardById(id: string): Promise<any>;
  getCardByName?(name: string): Promise<any>;
  searchByFilters(filters: any, limit?: number): Promise<any[]>;
  getAllCards(limit?: number): Promise<any[]>;
  getAvailableTags(): Promise<any[]>;
  addTagToCards?(tagName: string, cardIds: string[]): Promise<any>;
  removeTagFromCards?(tagName: string, cardIds?: string[]): Promise<void>;
  // File-based database specific methods
  initialize?(): Promise<void>;
  stats?(): any;
  exportDatabase?(): any;
  searchByNameSync?(query: string, limit?: number): any[];
  getCardByIdSync?(id: string): any;
  searchByFiltersSync?(filters: any, limit?: number): any[];
}

class FileDatabase implements DatabaseInterface {
  private async getServerDatabase() {
    const { serverCardDatabase } = await import('./server-card-database');
    await serverCardDatabase.initialize();
    return serverCardDatabase;
  }

  async searchByName(query: string, limit = 20) {
    const db = await this.getServerDatabase();
    return db.searchByName(query, limit);
  }
  
  async getCardById(id: string) {
    const db = await this.getServerDatabase();
    return db.getCardById(id);
  }
  
  async getCardByName(name: string) {
    const db = await this.getServerDatabase();
    return db.getCardByName ? db.getCardByName(name) : 
           db.searchByName(name, 1).find((card: any) => card.name === name) || null;
  }
  
  async searchByFilters(filters: any, limit = 50) {
    const db = await this.getServerDatabase();
    return db.searchByFilters(filters, limit);
  }
  
  async getAllCards(limit?: number) {
    const db = await this.getServerDatabase();
    return db.getAllCards ? db.getAllCards(limit) : db.searchByFilters({}, limit || 50000);
  }
  
  async getAvailableTags() {
    const db = await this.getServerDatabase();
    return db.getAvailableTags ? db.getAvailableTags() : [];
  }
  
  // File-specific methods that can be accessed directly
  async initialize() {
    return await this.getServerDatabase();
  }
  
  stats() {
    // Return sync stats if available
    return {};
  }
}

export function getDatabaseInstance(): DatabaseInterface {
  const dbType = (process.env.DATABASE_TYPE || 'file') as DatabaseType;
  
  switch (dbType) {
    case 'supabase':
      console.log('🗄️ Using Supabase database');
      return supabaseDb;
    case 'file':
    default:
      console.log('📁 Using file-based database');
      return new FileDatabase();
  }
}

// Singleton instance
export const database = getDatabaseInstance();