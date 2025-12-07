import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Paper } from './Paper';

@Entity()
export class PaperRelation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Paper)
  @JoinColumn()
  fromPaper: Paper;

  @ManyToOne(() => Paper)
  @JoinColumn()
  toPaper: Paper;

  @Column()
  relationship: string;

  @Column('text')
  description: string;

  @Column('text', { nullable: true })
  evidence: string; // LLM 分析的關係證據

  @Column('float', { default: 1.0 })
  confidence: number;

  @Column('int', { default: 1 })
  weight: number;

  @CreateDateColumn()
  createdAt: Date;
}
