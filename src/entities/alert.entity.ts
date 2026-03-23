import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { AlertType } from '../common/enums';
import { Endpoint } from './endpoint.entity';
import { User } from './user.entity';

@Entity('alerts')
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Endpoint, (endpoint) => endpoint.alerts, {
    onDelete: 'CASCADE',
  })
  endpoint: Endpoint;

  @Column()
  endpointId: string;

  @ManyToOne(() => User, (user) => user.alerts, { onDelete: 'CASCADE' })
  user: User;

  @Column()
  userId: string;

  @Column({ type: 'enum', enum: AlertType })
  type: AlertType;

  @Column()
  message: string;

  @CreateDateColumn()
  sentAt: Date;
}
