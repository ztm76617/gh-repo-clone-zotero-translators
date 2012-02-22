{
	"translatorID": "6614a99-479a-4524-8e30-686e4d66663e",
	"label": "Nature Publishing Group",
	"creator": "Aurimas Vinckevicius",
	"target": "https?://[^/]*nature\\.com(:[\\d]+)?(?=/)[^?]*(/(journal|archive|research|topten|search|full|abs)/|/current_issue.htm|/most.htm)",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 200,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcs",
	"lastUpdated": "2012-02-21 02:28:01"
}

/**
	Copyright (c) 2012 Aurimas Vinckevicius
	
	This program is free software: you can redistribute it and/or
	modify it under the terms of the GNU Affero General Public License
	as published by the Free Software Foundation, either version 3 of
	the License, or (at your option) any later version.
	
	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
	Affero General Public License for more details.
	
	You should have received a copy of the GNU Affero General Public
	License along with this program. If not, see
	<http://www.gnu.org/licenses/>.
*/

//get abstract
function getAbstract(doc) {
	var abstractLocations = [
		//e.g. 'lead' http://www.nature.com/emboj/journal/v31/n1/full/emboj2011343a.html
		//e.g. 'first_paragraph' http://www.nature.com/emboj/journal/vaop/ncurrent/full/emboj201239a.html
		'//p[contains(@class,"lead") or contains(@class,"first_paragraph")]',
		//e.g.
		'//div[@id="abs"]/*[self::div[not(contains(@class, "keyw-abbr"))] or self::p]',
		//e.g. 'first-paragraph' http://www.nature.com/nature/journal/v481/n7381/full/nature10669.html
		//e.g. 'standfirst' http://www.nature.com/nature/journal/v481/n7381/full/481237a.html
		'//div[@id="first-paragraph" or @class="standfirst"]/p',
		//e.g. http://www.nature.com/nature/journal/v481/n7381/full/nature10728.html
		'//div[contains(@id,"abstract")]/div[@class="content"]/p'
	];

	var paragraphs = [];

	for( var i=0, n=abstractLocations.length; i<n && !paragraphs.length; i++ ) {
		paragraphs = Zotero.Utilities.xpath(doc, abstractLocations[i]);
	}

	if( !paragraphs.length ) return null;

	var textArr = new Array();
	var p;
	for( var i=0, n=paragraphs.length; i<n; i++ ) {
		p = paragraphs[i].textContent.trim();
		if( p ) textArr.push(p);
	}

	return textArr.join("\n").trim() || null;
}

//some journals display keywords
function getKeywords(doc) {
	var keywords = Zotero.Utilities.xpathText(doc, '//p[@class="keywords"]') ||	//e.g. http://www.nature.com/onc/journal/v26/n6/full/1209842a.html
			Zotero.Utilities.xpathText(doc, '//ul[@class="keywords"]//ul/li', null, '') ||	//e.g. http://www.nature.com/emboj/journal/v31/n3/full/emboj2011459a.html
			Zotero.Utilities.xpathText(doc, '//div[contains(@class,"article-keywords")]/ul/li/a', null, '; ');	//e.g. http://www.nature.com/nature/journal/v481/n7382/full/481433a.html

	if( !keywords ) return null;

	return keywords.split(/[;,]\s+/);
}

//get PDF url
function getPdfUrl(url) {
	var m = url.match(/(^[^#?]+\/)(?:full|abs)(\/[^#?]+?\.)[a-zA-Z]+(?=$|\?|#)/);
	if( m && m.length) return m[1] + 'pdf' + m[2] + 'pdf';
}

//add using embedded metadata
function scrapeEmbedMeta(doc, url) {
	var translator = Zotero.loadTranslator("web");
	//Embedded Metadata translator
	translator.setTranslator("951c027d-74ac-47d4-a107-9c3069ab7b48");

	translator.setDocument(doc);

	translator.setHandler("itemDone", function(obj, item) {
		//remove all caps in Names and Titles
		for (i in item.creators){
			if (item.creators[i].lastName && item.creators[i].lastName == item.creators[i].lastName.toUpperCase()) {
				item.creators[i].lastName = Zotero.Utilities.capitalizeTitle(item.creators[i].lastName.toLowerCase(),true);
			}
			if (item.creators[i].firstName && item.creators[i].firstName == item.creators[i].firstName.toUpperCase()) {
				item.creators[i].firstName = Zotero.Utilities.capitalizeTitle(item.creators[i].firstName.toLowerCase(),true);
			}
		}

		if (item.title == item.title.toUpperCase()) {
			item.title = Zotero.Utilities.capitalizeTitle(item.title.toLowerCase(),true);
		}

		if(!item.abstractNote) item.abstractNote = getAbstract(doc);

		var pdf = getPdfUrl(url);
		if(pdf) {
			item.attachments = [{
				url: pdf,
				title: 'Full Text PDF',
				mimeType: 'application/pdf'}];
		}

		if( !item.tags || item.tags.length < 1 ) item.tags = getKeywords(doc);

		if (item.notes) item.notes = [];

		item.complete();
	});

	translator.translate();
}

function detectWeb(doc, url) {
	if( url.match(/\/(full|abs)\/[^\/]+($|\?|#)/) ) {

		return 'journalArticle';

	} else if( doc.title.toLowerCase().indexOf('table of contents') != -1 ||	//single issue ToC. e.g. http://www.nature.com/emboj/journal/v30/n1/index.html or http://www.nature.com/nature/journal/v481/n7381/index.html
		doc.title.toLowerCase().indexOf('current issue') != -1 ||
		url.indexOf('/research/') != -1 ||
		url.indexOf('/topten/') != -1 ||
		url.indexOf('/most.htm') != -1 ||
		( url.indexOf('/vaop/') != -1 && url.indexOf('index.html') != -1 ) ||		//advanced online publication
		url.indexOf('sp-q=') != -1 ) {		//search query

		return 'multiple';

	} else if( url.indexOf('/archive/') != -1 ) {
		if( url.indexOf('index.htm') != -1 ) return false;				//list of issues
		if( url.indexOf('subject.htm') != -1 ) return false;				//list of subjects
		if( url.indexOf('category.htm') != -1 && url.indexOf('code=') == -1 ) return false;	//list of categories

		return 'multiple';	//all else should be ok

	}
}

function doWeb(doc, url) {
	if( detectWeb(doc, url) == 'multiple' ) {
		var allHNodes = '*[self::h1 or self::h2 or self::h3 or self::h4 or self::h5]';
		var nodex, titlex, linkx;
		var nodes = [];

		if( url.indexOf('/search/') != -1 ||
			url.indexOf('/most.htm') != -1 ) {
			//search, "top" lists
			nodex = '//ol[@class="results-list" or @id="content-list"]/li';
			titlex = './' + allHNodes + '/node()[not(self::span)]';
			linkx = './' + allHNodes + '/a';

			nodes = Zotero.Utilities.xpath(doc, nodex);
		} else {

			//Maybe there's a nice way to figure out which journal uses what style, but for now we'll just try one until it matches
			//these seem to be listed in order of frequency
			var styles = [
				//oncogene
				{
					'nodex' : '//div[child::*[@class="atl"]]',
					'titlex' : './' + allHNodes + '/node()[not(self::span)]',
					'linkx' : './p[@class="links"]/a[contains(text(),"Full Text") or contains(text(),"Full text")]'
				},
				//embo journal
				{
					'nodex' : '//ul[@class="articles"]/li',
					'titlex' : './' + allHNodes + '[@class="article-title"]/node()[not(self::span)]',
					'linkx' : './ul[@class="article-links"]/li/a[contains(text(),"Full Text") or contains(text(),"Full text")]'
				},
				//nature
				{
					'nodex' : '//ul[contains(@class,"article-list") or contains(@class,"collapsed-list")]/li',
					'titlex' : './/' + allHNodes + '/a',
					'linkx' : './/' + allHNodes + '/a'
				}];

			for(var i=0; i<styles.length && nodes.length==0; i++) {
				nodex = styles[i].nodex;
				titlex = styles[i].titlex;
				linkx = styles[i].linkx;

				nodes = Zotero.Utilities.xpath(doc, nodex);
			}
		}

		if(nodes.length == 0) return false;	//nothing matched

		var items = new Object();
		var title, url;
		for(var i=0; i<nodes.length; i++) {
			title = Zotero.Utilities.xpathText(nodes[i], titlex, null, '');
			link = Zotero.Utilities.xpath(nodes[i], linkx);
			if(title && link.length==1) {
				items[link[0].href] = title.trim();
			}
		}

		var urls = new Array();

		Zotero.selectItems(items, function(selectedItems) {
			if( selectedItems == null ) return true;
			for( var item in selectedItems ) {
				urls.push(item);
			}
			Zotero.Utilities.processDocuments(urls,
				function(newDoc) {
					doWeb(newDoc, newDoc.location.href)
				},
				function() { Zotero.done(); });
			Zotero.wait(); });
	} else {
		scrapeEmbedMeta(doc, url);
	}
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://www.nature.com/onc/journal/v31/n6/index.html",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://www.nature.com/onc/journal/v31/n6/full/onc2011282a.html",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"firstName": "J.",
						"lastName": "Jiang",
						"creatorType": "author"
					},
					{
						"firstName": "Y.",
						"lastName": "Zhang",
						"creatorType": "author"
					},
					{
						"firstName": "S.",
						"lastName": "Chuai",
						"creatorType": "author"
					},
					{
						"firstName": "Z.",
						"lastName": "Wang",
						"creatorType": "author"
					},
					{
						"firstName": "D.",
						"lastName": "Zheng",
						"creatorType": "author"
					},
					{
						"firstName": "F.",
						"lastName": "Xu",
						"creatorType": "author"
					},
					{
						"firstName": "C.",
						"lastName": "Li",
						"creatorType": "author"
					},
					{
						"firstName": "Y.",
						"lastName": "Liang",
						"creatorType": "author"
					},
					{
						"firstName": "Z.",
						"lastName": "Chen",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [
					"gastric cancer",
					"cancer stem cells",
					"CD90",
					"ERBB2",
					"trastuzumab (herceptin)"
				],
				"seeAlso": [],
				"attachments": [
					{
						"url": "http://www.nature.com/onc/journal/v31/n6/pdf/onc2011282a.pdf",
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"itemID": "http://www.nature.com/onc/journal/v31/n6/full/onc2011282a.html",
				"title": "Trastuzumab (herceptin) targets gastric cancer stem cells characterized by CD90 phenotype",
				"source": "Oncogene",
				"publicationTitle": "Oncogene",
				"rights": "© 2011 Nature Publishing Group",
				"volume": "31",
				"issue": "6",
				"number": "6",
				"patentNumber": "6",
				"pages": "671-682",
				"ISSN": "0950-9232",
				"publisher": "Nature Publishing Group",
				"institution": "Nature Publishing Group",
				"company": "Nature Publishing Group",
				"label": "Nature Publishing Group",
				"distributor": "Nature Publishing Group",
				"date": "2011-07-11",
				"accessionNumber": "doi:10.1038/onc.2011.282",
				"DOI": "10.1038/onc.2011.282",
				"url": "http://www.nature.com/onc/journal/v31/n6/full/onc2011282a.html",
				"accessDate": "CURRENT_TIMESTAMP",
				"libraryCatalog": "www.nature.com",
				"abstractNote": "Identification and characterization of cancer stem cells (CSCs) in gastric cancer are difficult owing to the lack of specific markers and consensus methods. In this study, we show that cells with the CD90 surface marker in gastric tumors could be enriched under non-adherent, serum-free and sphere-forming conditions. These CD90+ cells possess a higher ability to initiate tumor in vivo and could re-establish the cellular hierarchy of tumors from single-cell implantation, demonstrating their self-renewal properties. Interestingly, higher proportion of CD90+ cells correlates with higher in vivo tumorigenicity of gastric primary tumor models. In addition, it was found that ERBB2 was overexpressed in about 25% of the gastric primary tumor models, which correlates with the higher level of CD90 expression in these tumors. Trastuzumab (humanized anti-ERBB2 antibody) treatment of high-tumorigenic gastric primary tumor models could reduce the CD90+ population in tumor mass and suppress tumor growth when combined with traditional chemotherapy. Moreover, tumorigenicity of tumor cells could also be suppressed when trastuzumab treatment starts at the same time as cell implantation. Therefore, we have identified a CSC population in gastric primary tumors characterized by their CD90 phenotype. The finding that trastuzumab targets the CSC population in gastric tumors suggests that ERBB2 signaling has a role in maintaining CSC populations, thus contributing to carcinogenesis and tumor invasion. In conclusion, the results from this study provide new insights into the gastric tumorigenic process and offer potential implications for the development of anticancer drugs as well as therapeutic treatment of gastric cancers."
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.nature.com/nature/journal/v482/n7384/full/nature10800.html",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"firstName": "Ross N.",
						"lastName": "Mitchell",
						"creatorType": "author"
					},
					{
						"firstName": "Taylor M.",
						"lastName": "Kilian",
						"creatorType": "author"
					},
					{
						"firstName": "David A. D.",
						"lastName": "Evans",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [
					"Geology",
					"Geophysics",
					"Earth sciences",
					"Planetary sciences"
				],
				"seeAlso": [],
				"attachments": [
					{
						"itemType": "journalArticle",
						"creators": [
							{
								"firstName": "Ross N.",
								"lastName": "Mitchell",
								"creatorType": "author"
							},
							{
								"firstName": "Taylor M.",
								"lastName": "Kilian",
								"creatorType": "author"
							},
							{
								"firstName": "David A. D.",
								"lastName": "Evans",
								"creatorType": "author"
							}
						],
						"notes": [],
						"tags": [],
						"seeAlso": [],
						"attachments": [],
						"itemID": "http://www.nature.com/nature/journal/v482/n7384/full/nature10800.html",
						"title": "Supercontinent cycles and the calculation of absolute palaeolongitude in deep time",
						"source": "Nature",
						"publicationTitle": "Nature",
						"rights": "© 2012 Nature Publishing Group, a division of Macmillan Publishers Limited. All Rights Reserved.",
						"volume": "482",
						"pages": "208-211",
						"ISSN": "0028-0836",
						"publisher": "Nature Publishing Group",
						"institution": "Nature Publishing Group",
						"company": "Nature Publishing Group",
						"label": "Nature Publishing Group",
						"distributor": "Nature Publishing Group",
						"date": "2012-02-08",
						"accessionNumber": "doi:10.1038/nature10800",
						"issue": "7384",
						"DOI": "10.1038/nature10800",
						"url": "http://www.nature.com/nature/journal/v482/n7384/full/nature10800.html",
						"accessDate": "CURRENT_TIMESTAMP",
						"libraryCatalog": "www.nature.com"
					}
				],
				"itemID": "http://www.nature.com/nature/journal/v482/n7384/full/nature10800.html",
				"title": "Supercontinent cycles and the calculation of absolute palaeolongitude in deep time",
				"source": "Nature",
				"publicationTitle": "Nature",
				"rights": "© 2012 Nature Publishing Group, a division of Macmillan Publishers Limited. All Rights Reserved.",
				"volume": "482",
				"pages": "208-211",
				"ISSN": "0028-0836",
				"publisher": "Nature Publishing Group",
				"institution": "Nature Publishing Group",
				"company": "Nature Publishing Group",
				"label": "Nature Publishing Group",
				"distributor": "Nature Publishing Group",
				"date": "2012-02-08",
				"accessionNumber": "doi:10.1038/nature10800",
				"issue": "7384",
				"DOI": "10.1038/nature10800",
				"url": "http://www.nature.com/nature/journal/v482/n7384/full/nature10800.html",
				"accessDate": "CURRENT_TIMESTAMP",
				"libraryCatalog": "www.nature.com"
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.nature.com/emboj/journal/vaop/ncurrent/index.html",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://www.nature.com/emboj/journal/vaop/ncurrent/full/emboj201217a.html",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"firstName": "Er-Chieh",
						"lastName": "Cho",
						"creatorType": "author"
					},
					{
						"firstName": "Shunsheng",
						"lastName": "Zheng",
						"creatorType": "author"
					},
					{
						"firstName": "Shonagh",
						"lastName": "Munro",
						"creatorType": "author"
					},
					{
						"firstName": "Geng",
						"lastName": "Liu",
						"creatorType": "author"
					},
					{
						"firstName": "Simon M",
						"lastName": "Carr",
						"creatorType": "author"
					},
					{
						"firstName": "Jutta",
						"lastName": "Moehlenbrink",
						"creatorType": "author"
					},
					{
						"firstName": "Yi-Chien",
						"lastName": "Lu",
						"creatorType": "author"
					},
					{
						"firstName": "Lindsay",
						"lastName": "Stimson",
						"creatorType": "author"
					},
					{
						"firstName": "Omar",
						"lastName": "Khan",
						"creatorType": "author"
					},
					{
						"firstName": "Rebecca",
						"lastName": "Konietzny",
						"creatorType": "author"
					},
					{
						"firstName": "Joanna",
						"lastName": "McGouran",
						"creatorType": "author"
					},
					{
						"firstName": "Amanda S",
						"lastName": "Coutts",
						"creatorType": "author"
					},
					{
						"firstName": "Benedikt",
						"lastName": "Kessler",
						"creatorType": "author"
					},
					{
						"firstName": "David J",
						"lastName": "Kerr",
						"creatorType": "author"
					},
					{
						"firstName": "Nicholas B La",
						"lastName": "Thangue",
						"creatorType": "author"
					}
				],
				"notes": [],
				"seeAlso": [],
				"attachments": [
					{
						"url": "http://www.nature.com/emboj/journal/vaop/ncurrent/pdf/emboj201217a.pdf",
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"itemID": "http://www.nature.com/emboj/journal/vaop/ncurrent/full/emboj201217a.html",
				"title": "Arginine methylation controls growth regulation by E2F-1",
				"source": "The EMBO Journal",
				"publicationTitle": "The EMBO Journal",
				"rights": "© 2012 Nature Publishing Group",
				"ISSN": "ERROR! NO ISSN",
				"publisher": "Nature Publishing Group",
				"institution": "Nature Publishing Group",
				"company": "Nature Publishing Group",
				"label": "Nature Publishing Group",
				"distributor": "Nature Publishing Group",
				"date": "2012-02-10",
				"accessionNumber": "doi:10.1038/emboj.2012.17",
				"DOI": "10.1038/emboj.2012.17",
				"url": "http://www.nature.com/emboj/journal/vaop/ncurrent/full/emboj201217a.html",
				"accessDate": "CURRENT_TIMESTAMP",
				"libraryCatalog": "www.nature.com"
			}
		]
	}
]
/** END TEST CASES **/