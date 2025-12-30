const pool = require('../config/database');

/**
 * Generate next invoice number (format: D251101)
 * D = Invoice prefix
 * 25 = Year (last 2 digits)
 * 11 = Month
 * 01 = Sequential number
 */
async function generateInvoiceNumber() {
  const now = new Date();
  const year = now.getFullYear() % 100; // Last 2 digits
  const month = now.getMonth() + 1;
  const prefix = 'D';

  return generateNumber('invoice', prefix, year, month);
}

/**
 * Generate next proposal number (format: P251101)
 * P = Proposal prefix
 * 25 = Year (last 2 digits)
 * 11 = Month
 * 01 = Sequential number
 */
async function generateProposalNumber() {
  const now = new Date();
  const year = now.getFullYear() % 100; // Last 2 digits
  const month = now.getMonth() + 1;
  const prefix = 'P';

  return generateNumber('proposal', prefix, year, month);
}

async function generateNumber(type, prefix, year, month) {
  try {
    // Get or create sequence record
    const [existing] = await pool.execute(
      `SELECT sequence FROM numbering_sequences 
       WHERE type = ? AND year = ? AND month = ?`,
      [type, year, month]
    );

    let sequence;
    if (existing.length === 0) {
      // Create new sequence for this month
      sequence = 1;
      await pool.execute(
        `INSERT INTO numbering_sequences (type, prefix, year, month, sequence, last_number) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [type, prefix, year, month, sequence, null]
      );
    } else {
      // Increment existing sequence
      sequence = existing[0].sequence + 1;
      await pool.execute(
        `UPDATE numbering_sequences 
         SET sequence = ?, last_number = ? 
         WHERE type = ? AND year = ? AND month = ?`,
        [sequence, null, type, year, month]
      );
    }

    // Format: P251101 or D251101
    const number = `${prefix}${year.toString().padStart(2, '0')}${month.toString().padStart(2, '0')}${sequence.toString().padStart(2, '0')}`;

    // Update last_number
    await pool.execute(
      `UPDATE numbering_sequences 
       SET last_number = ? 
       WHERE type = ? AND year = ? AND month = ?`,
      [number, type, year, month]
    );

    return number;
  } catch (error) {
    console.error('Error generating number:', error);
    throw error;
  }
}

/**
 * Generate next design document number (format: DD192345)
 * DD = Design Document prefix
 * 19 = Year (last 2 digits)
 * 23 = Month (2 digits)
 * 45 = Sequential number (2 digits)
 */
async function generateDesignDocumentNumber() {
  const now = new Date();
  const year = now.getFullYear() % 100; // Last 2 digits
  const month = now.getMonth() + 1;
  const prefix = 'DD';

  return generateNumber('design_document', prefix, year, month);
}

/**
 * Generate next service agreement number (format: S192345)
 * S = Service Agreement prefix
 * 19 = Year (last 2 digits)
 * 23 = Month (2 digits)
 * 45 = Sequential number (2 digits)
 */
async function generateServiceAgreementNumber() {
  const now = new Date();
  const year = now.getFullYear() % 100; // Last 2 digits
  const month = now.getMonth() + 1;
  const prefix = 'S';

  return generateNumber('service_agreement', prefix, year, month);
}

module.exports = {
  generateInvoiceNumber,
  generateProposalNumber,
  generateDesignDocumentNumber,
  generateServiceAgreementNumber,
};

