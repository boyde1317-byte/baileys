/**
 * Tests for rich message generators — verify that each generator
 * produces valid protobuf structures that encode/decode correctly.
 */
import { describe, it, expect } from 'vitest';
import { proto } from '../../WAProto/index.js';

describe('Rich message generators — protobuf encoding', () => {
  describe('AIRichResponseSubMessage', () => {
    it('encodes/decodes TEXT submessage (type 2)', () => {
      const msg = proto.AIRichResponseSubMessage.create({
        messageType: 2,
        messageText: 'Hello world'
      });
      const encoded = proto.AIRichResponseSubMessage.encode(msg).finish();
      const decoded = proto.AIRichResponseSubMessage.decode(encoded);
      expect(decoded.messageType).toBe(2);
      expect(decoded.messageText).toBe('Hello world');
    });

    it('encodes/decodes CODE submessage (type 3)', () => {
      const CodeBlock = proto.AIRichResponseCodeMetadata.AIRichResponseCodeBlock;
      const HighlightType = proto.AIRichResponseCodeMetadata.AIRichResponseCodeHighlightType;
      const msg = proto.AIRichResponseSubMessage.create({
        messageType: 3,
        codeMetadata: proto.AIRichResponseCodeMetadata.create({
          codeLanguage: 'javascript',
          codeBlocks: [
            CodeBlock.create({
              codeContent: 'console.log("hello")',
              highlightType: HighlightType.AI_RICH_RESPONSE_CODE_HIGHLIGHT_STRING
            })
          ]
        })
      });
      const encoded = proto.AIRichResponseSubMessage.encode(msg).finish();
      const decoded = proto.AIRichResponseSubMessage.decode(encoded);
      expect(decoded.messageType).toBe(3);
      expect(decoded.codeMetadata.codeLanguage).toBe('javascript');
      expect(decoded.codeMetadata.codeBlocks).toHaveLength(1);
    });

    it('encodes/decodes GRID_IMAGE submessage (type 1)', () => {
      const msg = proto.AIRichResponseSubMessage.create({
        messageType: 1,
        gridImageMetadata: proto.AIRichResponseGridImageMetadata.create({
          gridImageUrl: proto.AIRichResponseImageURL.create({
            imagePreviewUrl: 'https://example.com/preview.jpg',
            imageHighResUrl: 'https://example.com/hires.jpg',
            sourceUrl: 'https://example.com'
          })
        })
      });
      const encoded = proto.AIRichResponseSubMessage.encode(msg).finish();
      const decoded = proto.AIRichResponseSubMessage.decode(encoded);
      expect(decoded.messageType).toBe(1);
      expect(decoded.gridImageMetadata.gridImageUrl.imageHighResUrl).toBe('https://example.com/hires.jpg');
    });

    it('encodes/decodes DYNAMIC submessage (type 6)', () => {
      const msg = proto.AIRichResponseSubMessage.create({
        messageType: 6,
        dynamicMetadata: proto.AIRichResponseDynamicMetadata.create({
          type: proto.AIRichResponseDynamicMetadata.AIRichResponseDynamicMetadataType.AI_RICH_RESPONSE_DYNAMIC_METADATA_TYPE_GIF,
          url: 'https://example.com/anim.gif',
          version: '1'
        })
      });
      const encoded = proto.AIRichResponseSubMessage.encode(msg).finish();
      const decoded = proto.AIRichResponseSubMessage.decode(encoded);
      expect(decoded.messageType).toBe(6);
      expect(decoded.dynamicMetadata.url).toBe('https://example.com/anim.gif');
    });

    it('encodes/decodes MAP submessage (type 7)', () => {
      const msg = proto.AIRichResponseSubMessage.create({
        messageType: 7,
        mapMetadata: proto.AIRichResponseMapMetadata.create({
          centerLatitude: 5.6037,
          centerLongitude: 0.1870,
          latDelta: 0.01,
          lngDelta: 0.01
        })
      });
      const encoded = proto.AIRichResponseSubMessage.encode(msg).finish();
      const decoded = proto.AIRichResponseSubMessage.decode(encoded);
      expect(decoded.messageType).toBe(7);
      expect(decoded.mapMetadata.centerLatitude).toBeCloseTo(5.6037, 4);
    });

    it('encodes/decodes TABLE submessage (type 4)', () => {
      const TableRow = proto.AIRichResponseTableMetadata.AIRichResponseTableRow;
      const msg = proto.AIRichResponseSubMessage.create({
        messageType: 4,
        tableMetadata: proto.AIRichResponseTableMetadata.create({
          title: 'Test Table',
          rows: [
            TableRow.create({
              items: ['Cell A', 'Cell B']
            })
          ]
        })
      });
      const encoded = proto.AIRichResponseSubMessage.encode(msg).finish();
      const decoded = proto.AIRichResponseSubMessage.decode(encoded);
      expect(decoded.messageType).toBe(4);
      expect(decoded.tableMetadata.title).toBe('Test Table');
      expect(decoded.tableMetadata.rows).toHaveLength(1);
    });
  });

  describe('AIRichResponseMessage', () => {
    it('wraps multiple submessages in a full rich response', () => {
      const submessages = [
        proto.AIRichResponseSubMessage.create({ messageType: 2, messageText: 'Header' }),
        proto.AIRichResponseSubMessage.create({
          messageType: 1,
          gridImageMetadata: proto.AIRichResponseGridImageMetadata.create({
            gridImageUrl: proto.AIRichResponseImageURL.create({
              imageHighResUrl: 'https://example.com/img.jpg'
            })
          })
        }),
        proto.AIRichResponseSubMessage.create({ messageType: 2, messageText: 'Footer' })
      ];

      const richMsg = proto.AIRichResponseMessage.create({
        messageType: proto.AIRichResponseMessageType.AI_RICH_RESPONSE_TYPE_STANDARD,
        submessages
      });

      const encoded = proto.AIRichResponseMessage.encode(richMsg).finish();
      const decoded = proto.AIRichResponseMessage.decode(encoded);

      expect(decoded.submessages).toHaveLength(3);
      expect(decoded.submessages[0].messageText).toBe('Header');
      expect(decoded.submessages[1].messageType).toBe(1);
      expect(decoded.submessages[2].messageText).toBe('Footer');
    });

    it('wraps rich response in main Message proto', () => {
      const richMsg = proto.AIRichResponseMessage.create({
        messageType: proto.AIRichResponseMessageType.AI_RICH_RESPONSE_TYPE_STANDARD,
        submessages: [
          proto.AIRichResponseSubMessage.create({ messageType: 2, messageText: 'Test' })
        ]
      });

      const mainMsg = proto.Message.create({ richResponseMessage: richMsg });
      const encoded = proto.Message.encode(mainMsg).finish();
      const decoded = proto.Message.decode(encoded);

      expect(decoded.richResponseMessage).toBeDefined();
      expect(decoded.richResponseMessage.submessages).toHaveLength(1);
      expect(decoded.richResponseMessage.submessages[0].messageText).toBe('Test');
    });
  });
});
