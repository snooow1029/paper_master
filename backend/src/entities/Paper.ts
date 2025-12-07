import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToMany, JoinTable } from 'typeorm';

@Entity()
export class Paper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  url: string;

  @Column()
  title: string;

  @Column('simple-array')
  authors: string[];

  @Column('text')
  abstract: string;

  @Column('text', { nullable: true })
  introduction: string;

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

  // Many-to-Many self-referencing relations for citation network
  @ManyToMany(() => Paper, (paper) => paper.citedBy)
  @JoinTable({
    name: 'paper_references',
    joinColumn: { name: 'paperId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'referenceId', referencedColumnName: 'id' },
  })
  references: Paper[]; // Papers that this paper cites

  @ManyToMany(() => Paper, (paper) => paper.references)
  citedBy: Paper[]; // Papers that cite this paper

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
