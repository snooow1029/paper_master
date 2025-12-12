import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from './User';
import { Analysis } from './Analysis';

@Entity()
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.sessions, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @Column()
  userId: string;

  @Column({ default: 'New Session' })
  title: string;

  @Column('text', { nullable: true })
  description: string;

  @Column('text', { nullable: true })
  graphSnapshot: string; // JSON stringified graphData for instant UI restoration

  @Column('text', { nullable: true })
  priorWorksSnapshot: string; // JSON stringified priorWorks data (Record<string, any[]>)

  @Column('text', { nullable: true })
  derivativeWorksSnapshot: string; // JSON stringified derivativeWorks data (Record<string, any[]>)

  @OneToMany(() => Analysis, (analysis) => analysis.session, { cascade: true })
  analyses: Analysis[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

