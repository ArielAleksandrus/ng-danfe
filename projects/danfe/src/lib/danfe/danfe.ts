import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import JsBarcode from 'jsbarcode';

import { DanfeData } from './danfe-data';
import { parseDanfeXml } from './danfe-parser';

(pdfMake as any).vfs = (pdfFonts as any).pdfMake.vfs;

@Component({
  selector: 'lib-danfe',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './danfe.html',
  styleUrl: './danfe.scss'
})
export class Danfe implements OnChanges {
  @Input() xml?: string;
  @Input() showPreview: boolean = true;
  @Input() showActions: boolean = true;

  data: DanfeData | null = null;
  errorMessage: string | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['xml']?.currentValue) {
      try {
        this.data = parseDanfeXml(changes['xml'].currentValue);
        this.errorMessage = null;
      } catch (err: any) {
        console.error('Erro ao parsear XML DANFE:', err);
        this.errorMessage = err.message || 'Falha ao processar o XML da NF-e/NFC-e';
        this.data = null;
      }
    }
  }

  formatCnpj(cnpj: string | undefined): string {
    if (!cnpj || cnpj.length !== 14) return cnpj || '—';
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }

  private generateBarcodeBase64(): string {
    if (!this.data?.chave_de_acesso || this.data.tipo === 'nfce') return '';
    
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, this.data.chave_de_acesso.replace(/\s/g, ''), {
      format: 'CODE128',
      width: 2,
      height: 60,
      displayValue: false,
      margin: 5
    });
    return canvas.toDataURL('image/png');
  }

  private getPdfDefinition(): any {
    if (!this.data) return {};

    const isNfce = this.data.tipo === 'nfce';
    const barcode = this.generateBarcodeBase64();

    return {
      pageSize: isNfce ? { width: 226.77, height: 'auto' } : 'A4',
      pageMargins: isNfce ? [12, 12, 12, 20] : [40, 60, 40, 60],
      content: [
        { text: this.data.empresa.toUpperCase(), style: 'header', alignment: 'center' },
        { text: `CNPJ: ${this.data.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')}`, style: 'subheader', alignment: 'center' },
        { text: this.data.endereco, style: 'small', alignment: 'center' },
        ...(this.data.telefone ? [{ text: `Telefone: ${this.data.telefone}`, style: 'small', alignment: 'center', margin: [0, 4] }] : []),

        { text: isNfce ? 'DANFE NFC-e' : 'DANFE NF-e', style: 'title', margin: [0, 12], alignment: 'center' },

        ...(isNfce
          ? [
              { text: 'Consulte pela chave de acesso ou QR Code', style: 'small', alignment: 'center', margin: [0, 8] },
              { qr: this.data.qrCode || this.data.chave_de_acesso.replace(/\s/g, ''), fit: 110, alignment: 'center', margin: [0, 8] }
            ]
          : [
              { image: barcode, width: 380, alignment: 'center', margin: [0, 8] },
              { text: this.data.chave_de_acesso, style: 'chave', alignment: 'center', margin: [0, 6] }
            ]),

        {
          table: {
            headerRows: 1,
            widths: isNfce ? ['*', 'auto', 'auto'] : ['auto', '*', 'auto', 'auto'],
            body: [
              isNfce
                ? ['Descrição', 'Qtde', 'Valor']
                : ['Cód.', 'Descrição', 'Qtde', 'Valor Total'],
              ...this.data.produtos.map(p => isNfce
                ? [p.name.substring(0, 38), p.qty, `R$ ${Number(p.total_value).toFixed(2)}`]
                : ['-', p.name.substring(0, 45), p.qty, `R$ ${Number(p.total_value).toFixed(2)}`]
              )
            ]
          },
          layout: 'lightHorizontalLines',
          margin: [0, 12, 0, 8]
        },

        { text: `Subtotal:      R$ ${this.data.subtotal.toFixed(2)}`, alignment: 'right', style: 'totalLine' },
        ...(this.data.discount > 0 ? [{ text: `Desconto:     -R$ ${this.data.discount.toFixed(2)}`, alignment: 'right', style: 'totalLine' }] : []),
        ...(this.data.extra > 0    ? [{ text: `Outras Desp.: R$ ${this.data.extra.toFixed(2)}`,    alignment: 'right', style: 'totalLine' }] : []),
        { text: `Total NF-e/NFC-e: R$ ${this.data.total.toFixed(2)}`, alignment: 'right', style: 'grandTotal' },

        ...(this.data.tributos > 0 ? [{
          text: `(*) Valor aproximado de tributos: R$ ${this.data.tributos.toFixed(2)}`,
          style: 'small',
          alignment: 'center',
          margin: [0, 12]
        }] : []),

        { text: 'Forma(s) de Pagamento', style: 'subheader', margin: [0, 12], alignment: 'center' },
        {
          table: {
            widths: ['*', 'auto'],
            body: [
              ['Descrição', 'Valor'],
              ...this.data.pagamentos.map(p => [
                p.payment_method_name,
                `R$ ${Number(p.value_payed).toFixed(2)}`
              ])
            ]
          },
          layout: 'lightHorizontalLines'
        },

        { text: `Protocolo de Autorização: ${this.data.protocolo_de_autorizacao || 'PENDENTE'}`, style: 'small', alignment: 'center', margin: [0, 12] },
        { text: `Emissão: ${this.data.dia_e_hora || '—'}`, style: 'small', alignment: 'center' },
        { text: `Consumidor: ${this.data.consumidor}`, style: 'small', alignment: 'center', margin: [0, 4] }
      ],
      styles: {
        header:     { fontSize: 14, bold: true },
        title:      { fontSize: 16, bold: true },
        subheader:  { fontSize: 11 },
        small:      { fontSize: 9 },
        chave:      { fontSize: 10, alignment: 'center' },
        totalLine:  { fontSize: 11, margin: [0, 2] },
        grandTotal: { fontSize: 14, bold: true, margin: [0, 8] }
      }
    };
  }

  downloadPdf(): void {
    if (!this.data) return;
    pdfMake.createPdf(this.getPdfDefinition()).download(
      `danfe-${this.data.tipo}-${this.data.chave_de_acesso.replace(/\s/g, '').slice(-8)}.pdf`
    );
  }

  print(): void {
    if (!this.data) return;
    pdfMake.createPdf(this.getPdfDefinition()).print();
  }
}