// Database factory to switch between file-based and Supabase databases
import { supabaseDb } from './supabase';
import { 
  searchCardsByName as fileSearchByName,
  getCardById as fileGetCardById,
  searchCardsByFilters as fileSearchByFilters,
  getAllCards as fileGetAllCards,
  getAvailableTags as fileGetAvailableTags
} from './server-card-database';

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
  async searchByName(query: string, limit = 20) {
    return await fileSearchByName(query, limit);
  }
  
  async getCardById(id: string) {
    return await fileGetCardById(id);
  }
  
  async getCardByName(name: string) {
    // File database doesn't have getCardByName, so use search
    const results = await this.searchByName(name, 1);
    return results.find(card => card.name === name) || null;
  }
  
  async searchByFilters(filters: any, limit = 50) {
    return await fileSearchByFilters(filters, limit);
  }
  
  async getAllCards(limit?: number) {
    return await fileGetAllCards(limit);
  }
  
  async getAvailableTags() {
    return await fileGetAvailableTags();
  }
  
  // File-specific methods that can be accessed directly
  async initialize() {
    const { serverCardDatabase } = await import('./server-card-database');
    return await serverCardDatabase.initialize();
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