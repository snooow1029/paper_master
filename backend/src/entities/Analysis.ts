import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Session } from './Session';
import { Paper } from './Paper';

@Entity()
export class Analysis {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Session, (session) => session.analyses, { onDelete: 'CASCADE' })
  @JoinColumn()
  session: Session;

  @Column()
  sessionId: string;

  @ManyToOne(() => Paper, { onDelete: 'CASCADE' })
  @JoinColumn()
  paper: Paper;

  @Column()
  paperId: string;

  @Column('text', { nullable: true })
  notes: string;

  @Column('simple-json', { nullable: true })
  relationshipGraph: {
    nodes: Array<{
      id: string;
      label: string;
      [key: string]: any;
    }>;
    edges: Array<{
      id: string;
      from: string;
      to: string;
      label: string;
      [key: string]: any;
    }>;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

