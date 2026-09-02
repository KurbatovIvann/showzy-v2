import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { uahAmountInWords } from "../services/amount-in-words.js";
import {
  formatIssuedOn,
  formatMoneyUah,
  formatQuantityMilli,
} from "../services/format-pdf-text.js";
import { ensureLiberationSans, LIBERATION_SANS } from "./liberation-sans.js";
import {
  DOCUMENT_TITLE,
  type BuyerFace,
  type DocumentPdfModel,
  type SellerFace,
} from "./model.js";
import { faceLines } from "./pdf-faces.js";

const styles = StyleSheet.create({
  page: {
    fontFamily: LIBERATION_SANS,
    fontSize: 10,
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 40,
    color: "#111",
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 4,
  },
  meta: {
    marginBottom: 16,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    marginBottom: 4,
  },
  line: {
    marginBottom: 2,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#111",
    paddingBottom: 4,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  colTitle: { width: "40%" },
  colQty: { width: "15%", textAlign: "right" },
  colPrice: { width: "20%", textAlign: "right" },
  colSum: { width: "25%", textAlign: "right" },
  totals: {
    marginTop: 12,
    alignItems: "flex-end",
  },
  totalLine: {
    marginBottom: 2,
  },
  amountInWords: {
    marginTop: 8,
    fontStyle: "italic",
  },
});

function FaceBlock({
  title,
  face,
}: {
  readonly title: string;
  readonly face: SellerFace | BuyerFace;
}) {
  const lines = faceLines(face);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {lines.map((line, index) => (
        <Text key={`${String(index)}:${line}`} style={styles.line}>
          {line}
        </Text>
      ))}
    </View>
  );
}

export function DocumentPdf({ model }: { readonly model: DocumentPdfModel }) {
  ensureLiberationSans();
  const title = DOCUMENT_TITLE[model.type];
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.meta}>
          <Text style={styles.line}>№ {model.documentNumber}</Text>
          <Text style={styles.line}>
            Дата: {formatIssuedOn(model.issuedOn)}
          </Text>
        </View>
        <FaceBlock title="Постачальник" face={model.supplier} />
        <FaceBlock title="Покупець" face={model.buyer} />
        <View style={styles.tableHeader}>
          <Text style={styles.colTitle}>Найменування</Text>
          <Text style={styles.colQty}>К-сть</Text>
          <Text style={styles.colPrice}>Ціна</Text>
          <Text style={styles.colSum}>Сума</Text>
        </View>
        {model.items.map((item) => (
          <View key={item.itemId} style={styles.tableRow} wrap={false}>
            <Text style={styles.colTitle}>{item.title}</Text>
            <Text style={styles.colQty}>
              {formatQuantityMilli(item.quantityMilli)}
            </Text>
            <Text style={styles.colPrice}>
              {formatMoneyUah(item.unitPriceMinor)}
            </Text>
            <Text style={styles.colSum}>
              {formatMoneyUah(item.grossAmountMinor)}
            </Text>
          </View>
        ))}
        <View style={styles.totals}>
          <Text style={styles.totalLine}>
            Разом без ПДВ: {formatMoneyUah(model.totalNetMinor)}
          </Text>
          <Text style={styles.totalLine}>
            ПДВ: {formatMoneyUah(model.totalTaxMinor)}
          </Text>
          <Text style={styles.totalLine}>
            Всього: {formatMoneyUah(model.totalGrossMinor)}
          </Text>
          <Text style={styles.amountInWords}>
            Сума прописом: {uahAmountInWords(model.totalGrossMinor)}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
