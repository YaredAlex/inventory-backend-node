import { DataTypes, Model, Sequelize, Optional } from "sequelize";

export enum PurchaseStatus {
  PENDING = "pending",
  APPROVED = "approved",
  SHIPPED = "shipped",
  RECEIVED = "received",
  CANCELLED = "cancelled",
}

interface PurchaseOrderAttributes {
  id: number;
  order_number: string;
  branch_id: number;
  supplier: string;
  order_date: Date;
  expected_delivery_date: Date | null;
  actual_delivery_date: Date | null;
  status: PurchaseStatus;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  tax_amount: number;
  shipping_cost: number;
  discount_amount: number;
  total_amount: number;
  notes: string | null;
  created_by: number;
  created_at: Date;
  updated_at: Date | null;
}

interface PurchaseOrderCreationAttributes extends Optional<
  PurchaseOrderAttributes,
  | "id"
  | "expected_delivery_date"
  | "actual_delivery_date"
  | "subtotal"
  | "vat_rate"
  | "vat_amount"
  | "tax_amount"
  | "shipping_cost"
  | "discount_amount"
  | "total_amount"
  | "notes"
  | "updated_at"
> {}

export class PurchaseOrder
  extends Model<PurchaseOrderAttributes, PurchaseOrderCreationAttributes>
  implements PurchaseOrderAttributes
{
  public id!: number;
  public order_number!: string;
  public branch_id!: number;
  public supplier!: string;
  public order_date!: Date;
  public expected_delivery_date!: Date | null;
  public actual_delivery_date!: Date | null;
  public status!: PurchaseStatus;
  public subtotal!: number;
  public vat_rate!: number;
  public vat_amount!: number;
  public tax_amount!: number;
  public shipping_cost!: number;
  public discount_amount!: number;
  public total_amount!: number;
  public notes!: string | null;
  public created_by!: number;
  public created_at!: Date;
  public updated_at!: Date | null;

  public static associate(models: any) {
    PurchaseOrder.belongsTo(models.Branch, {
      foreignKey: "branch_id",
      as: "branch",
    });
    PurchaseOrder.belongsTo(models.User, {
      foreignKey: "created_by",
      as: "creator",
    });
    PurchaseOrder.hasMany(models.PurchaseOrderItem, {
      foreignKey: "purchase_order_id",
      as: "items",
      onDelete: "CASCADE",
    });
    PurchaseOrder.hasMany(models.Purchase, {
      foreignKey: "purchase_order_id",
      as: "purchases",
    });
  }

  public static initModel(sequelize: Sequelize): typeof PurchaseOrder {
    PurchaseOrder.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        order_number: {
          type: DataTypes.STRING(50),
          unique: true,
          allowNull: false,
        },
        branch_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: "branches",
            key: "id",
          },
        },
        supplier: {
          type: DataTypes.STRING(200),
          allowNull: false,
        },
        order_date: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW,
          allowNull: false,
        },
        expected_delivery_date: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        actual_delivery_date: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        status: {
          type: DataTypes.ENUM(...Object.values(PurchaseStatus)),
          defaultValue: PurchaseStatus.PENDING,
        },
        subtotal: {
          type: DataTypes.DECIMAL(12, 2),
          defaultValue: 0,
        },
        vat_rate: {
          type: DataTypes.DECIMAL(5, 2),
          defaultValue: 15,
        },
        vat_amount: {
          type: DataTypes.DECIMAL(12, 2),
          defaultValue: 0,
        },
        tax_amount: {
          type: DataTypes.DECIMAL(12, 2),
          defaultValue: 0,
        },
        shipping_cost: {
          type: DataTypes.DECIMAL(12, 2),
          defaultValue: 0,
        },
        discount_amount: {
          type: DataTypes.DECIMAL(12, 2),
          defaultValue: 0,
        },
        total_amount: {
          type: DataTypes.DECIMAL(12, 2),
          defaultValue: 0,
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        created_by: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: "users",
            key: "id",
          },
        },
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW,
        },
        updated_at: {
          type: DataTypes.DATE,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: "purchase_orders",
        timestamps: false,
        underscored: true,
      },
    );

    return PurchaseOrder;
  }
}
