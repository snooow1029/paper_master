import { DataSource } from 'typeorm';
import { Paper } from '../entities/Paper';
import { PaperRelation } from '../entities/PaperRelation';

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: 'database.sqlite',
  synchronize: true,
  logging: false,
  entities: [Paper, PaperRelation],
  migrations: [],
  subscribers: [],
});
