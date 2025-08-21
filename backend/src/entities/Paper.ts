import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class Paper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column('simple-array')
  authors: string[];

  @Column('text')
  abstract: string;

  @Column('text', { nullable: true })
  introduction: string;

  @Column()
  url: string;

  @Column({ nullable: true })
  doi: string;

  @Column({ nullable: true })
  arxivId: string;

  @Column({ nullable: true })
  publishedDate: string;

  @Column('simple-array')
  tags: string[];

  @Column('text', { nullable: true })
  fullText: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
