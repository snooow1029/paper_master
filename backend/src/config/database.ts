import { DataSource, DataSourceOptions } from 'typeorm';
import { Paper } from '../entities/Paper';
import { PaperRelation } from '../entities/PaperRelation';

const databaseUrl = process.env.DATABASE_URL;
const usePostgres = Boolean(databaseUrl);

const commonOptions = {
  synchronize: true,
  logging: false,
  entities: [Paper, PaperRelation],
  migrations: [],
  subscribers: [],
};

const dataSourceOptions: DataSourceOptions = usePostgres
  ? {
      type: 'postgres',
      url: databaseUrl,
      ssl:
        process.env.DB_SSL === 'true'
          ? { rejectUnauthorized: false }
          : false,
      ...commonOptions,
    }
  : {
      type: 'sqlite',
      database: 'database.sqlite',
      ...commonOptions,
    };

export const AppDataSource = new DataSource(dataSourceOptions);
